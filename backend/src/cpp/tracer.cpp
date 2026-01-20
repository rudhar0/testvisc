// src/cpp/tracer.cpp
// ------------------------------------------------------------
// Cross-platform instrumentation tracer (C & C++)
// ------------------------------------------------------------
//  • Captures function entry / exit
//  • Captures variable assignments (via TRACE_* macros)
//  • Tracks heap allocations (new / delete / malloc / free)
//  • ✅ NEW: Beginner-mode declaration/assignment tracking
//  • Works on Linux/macOS *and* Windows (MinGW-w64)
// ------------------------------------------------------------

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <ctime>
#include <cstddef>
#include <algorithm>
#include <string>

#ifdef _WIN32
    #include <windows.h>          // CRITICAL_SECTION, QueryPerformanceCounter, etc.
#else
    #include <dlfcn.h>           // dladdr, dlsym
    #include <cxxabi.h>          // __cxa_demangle
    #include <sys/time.h>        // gettimeofday
    #include <unistd.h>
    #include <mutex>
#endif

#include "trace.h"

// --------------------------------------------------------------------
// Global state
// --------------------------------------------------------------------
static FILE*   g_trace_file    = nullptr;        // JSON trace file
static int     g_depth         = 0;            // current call-stack depth
static unsigned long g_event_counter = 0;         // monotonically increasing id

#ifndef _WIN32
static std::mutex g_trace_mutex;                 // POSIX-only mutex
#endif

// --------------------------------------------------------------------
// High-resolution timestamp (microseconds)
// --------------------------------------------------------------------
static inline unsigned long get_timestamp_us() {
#ifdef _WIN32
    static LARGE_INTEGER freq{};
    static BOOL initialized = FALSE;
    if (!initialized) {
        QueryPerformanceFrequency(&freq);
        initialized = TRUE;
    }
    LARGE_INTEGER now;
    QueryPerformanceCounter(&now);
    return static_cast<unsigned long>((now.QuadPart * 1000000ULL) / freq.QuadPart);
#else
    struct timeval tv{};
    gettimeofday(&tv, nullptr);
    return static_cast<unsigned long>(tv.tv_sec * 1000000UL + tv.tv_usec);
#endif
}

// --------------------------------------------------------------------
// Simple lock / unlock helpers (POSIX only)
// --------------------------------------------------------------------
static void lock_trace() {
#ifndef _WIN32
    g_trace_mutex.lock();
#endif
}
static void unlock_trace() {
#ifndef _WIN32
    g_trace_mutex.unlock();
#endif
}

// --------------------------------------------------------------------
// Demangle C++ symbols (POSIX only)
// --------------------------------------------------------------------
static const char* demangle(const char* name) {
#ifndef _WIN32
    if (!name) return "unknown";
    int status = 0;
    char* real = abi::__cxa_demangle(name, nullptr, nullptr, &status);
    if (status == 0 && real) {
        static __thread char buffer[512];
        strncpy(buffer, real, sizeof(buffer) - 1);
        buffer[sizeof(buffer) - 1] = '\0';
        free(real);
        return buffer;
    }
    return name;
#else
    return name;   // Windows – keep the (already) mangled name
#endif
}

// --------------------------------------------------------------------
// Write a JSON event (thread-safe)
// --------------------------------------------------------------------
static void write_json_event(const char* type, void* addr,
                             const char* func_name, int depth,
                             const char* extra = nullptr) {
    lock_trace();

    if (!g_trace_file) { unlock_trace(); return; }

    if (g_event_counter > 0) fputs(",\n", g_trace_file);

    fprintf(g_trace_file,
            "  {\"id\":%lu,\"type\":\"%s\",\"addr\":\"%p\",\"func\":\"%s\",\"depth\":%d,\"ts\":%lu",
            g_event_counter++, type, addr,
            func_name ? func_name : "unknown",
            depth, get_timestamp_us());

    if (extra) fprintf(g_trace_file, ",%s", extra);
    fputs("}", g_trace_file);
    fflush(g_trace_file);

    unlock_trace();
}

/* --------------------------------------------------------------------
   Convert a Windows path like "C:\a\b\c.cpp" to a JSON-safe forward-slash
   version "C:/a/b/c.cpp".  This is needed because backslashes would
   otherwise terminate the JSON string.
   -------------------------------------------------------------------- */
static std::string json_safe_path(const char* raw) {
    if (!raw) return "";
    std::string s(raw);
    std::replace(s.begin(), s.end(), '\\', '/');
    return s;
}

/* --------------------------------------------------------------------
   ✅ NEW: BEGINNER-MODE VARIABLE DECLARATION HELPER
   Creates explicit "declare" event when a variable is declared
   -------------------------------------------------------------------- */
extern "C" void __trace_declare_loc(const char* name, const char* type,
                                    const char* file, int line) {
    if (!g_trace_file) return;
    const std::string f = json_safe_path(file);
    char extra[256];
    snprintf(extra, sizeof(extra),
             "\"name\":\"%s\",\"varType\":\"%s\",\"value\":null,\"file\":\"%s\",\"line\":%d",
             name, type, f.c_str(), line);
    write_json_event("declare", nullptr, name, g_depth, extra);
}

/* --------------------------------------------------------------------
   ✅ NEW: BEGINNER-MODE VARIABLE ASSIGNMENT HELPER
   Creates explicit "assign" event when a variable is assigned
   -------------------------------------------------------------------- */
extern "C" void __trace_assign_loc(const char* name, long long value,
                                    const char* file, int line) {
    if (!g_trace_file) return;
    const std::string f = json_safe_path(file);
    char extra[256];
    snprintf(extra, sizeof(extra),
             "\"name\":\"%s\",\"value\":%lld,\"file\":\"%s\",\"line\":%d",
             name, value, f.c_str(), line);
    write_json_event("assign", nullptr, name, g_depth, extra);
}

/* --------------------------------------------------------------------
   VARIABLE-TRACING HELPERS (exposed via trace.h)
   Each function receives the source file and line number so the backend
   can create a step without address resolution.
   -------------------------------------------------------------------- */
extern "C" void trace_var_int_loc(const char* name, int value,
                                   const char* file, int line) {
    if (!g_trace_file) return;
    const std::string f = json_safe_path(file);
    char extra[256];
    snprintf(extra, sizeof(extra),
             "\"name\":\"%s\",\"value\":%d,\"type\":\"int\",\"file\":\"%s\",\"line\":%d",
             name, value, f.c_str(), line);
    write_json_event("var", nullptr, name, g_depth, extra);
}
extern "C" void trace_var_long_loc(const char* name, long long value,
                                    const char* file, int line) {
    if (!g_trace_file) return;
    const std::string f = json_safe_path(file);
    char extra[256];
    snprintf(extra, sizeof(extra),
             "\"name\":\"%s\",\"value\":%lld,\"type\":\"long\",\"file\":\"%s\",\"line\":%d",
             name, value, f.c_str(), line);
    write_json_event("var", nullptr, name, g_depth, extra);
}
extern "C" void trace_var_double_loc(const char* name, double value,
                                      const char* file, int line) {
    if (!g_trace_file) return;
    const std::string f = json_safe_path(file);
    char extra[256];
    snprintf(extra, sizeof(extra),
             "\"name\":\"%s\",\"value\":%f,\"type\":\"double\",\"file\":\"%s\",\"line\":%d",
             name, value, f.c_str(), line);
    write_json_event("var", nullptr, name, g_depth, extra);
}
extern "C" void trace_var_ptr_loc(const char* name, void* value,
                                  const char* file, int line) {
    if (!g_trace_file) return;
    const std::string f = json_safe_path(file);
    char extra[256];
    snprintf(extra, sizeof(extra),
             "\"name\":\"%s\",\"value\":\"%p\",\"type\":\"pointer\",\"file\":\"%s\",\"line\":%d",
             name, value, f.c_str(), line);
    write_json_event("var", nullptr, name, g_depth, extra);
}
extern "C" void trace_var_str_loc(const char* name, const char* value,
                                  const char* file, int line) {
    if (!g_trace_file) return;
    const std::string f = json_safe_path(file);
    // Escape quotes and backslashes inside the string value
    char escaped[256];
    int j = 0;
    for (int i = 0; value && value[i] && i < 250; ++i) {
        if (value[i] == '"' || value[i] == '\\') escaped[j++] = '\\';
        escaped[j++] = value[i];
    }
    escaped[j] = '\0';
    char extra[512];
    snprintf(extra, sizeof(extra),
             "\"name\":\"%s\",\"value\":\"%s\",\"type\":\"string\",\"file\":\"%s\",\"line\":%d",
             name, escaped, f.c_str(), line);
    write_json_event("var", nullptr, name, g_depth, extra);
}

/* --------------------------------------------------------------------
   Backward-compatible wrappers (no source location) – kept so
   hand-written code that still calls the old API does not break.
   -------------------------------------------------------------------- */
extern "C" void trace_var_int(const char* name, int value) {
    trace_var_int_loc(name, value, "unknown", 0);
}
extern "C" void trace_var_long(const char* name, long long value) {
    trace_var_long_loc(name, value, "unknown", 0);
}
extern "C" void trace_var_double(const char* name, double value) {
    trace_var_double_loc(name, value, "unknown", 0);
}
extern "C" void trace_var_ptr(const char* name, void* value) {
    trace_var_ptr_loc(name, value, "unknown", 0);
}
extern "C" void trace_var_str(const char* name, const char* value) {
    trace_var_str_loc(name, value, "unknown", 0);
}

/* --------------------------------------------------------------------
   FUNCTION ENTRY / EXIT HOOKS (added automatically by -finstrument-functions)
   -------------------------------------------------------------------- */
extern "C" void __cyg_profile_func_enter(void* func, void* caller)
    __attribute__((no_instrument_function));
void __cyg_profile_func_enter(void* func, void* caller) {
    const char* func_name = "unknown";

#ifndef _WIN32
    Dl_info dlinfo{};
    if (dladdr(func, &dlinfo) && dlinfo.dli_sname) {
        func_name = demangle(dlinfo.dli_sname);
        // Skip obvious system libraries on POSIX
        if (dlinfo.dli_fname &&
            (strstr(dlinfo.dli_fname, "/usr/") ||
             strstr(dlinfo.dli_fname, "/lib/") ||
             strstr(dlinfo.dli_fname, "libc") ||
             strstr(dlinfo.dli_fname, "libstdc++"))) {
            return;
        }
    }
#endif

    char extra[256];
    snprintf(extra, sizeof(extra), "\"caller\":\"%p\"", caller);
    write_json_event("func_enter", func, func_name, g_depth++, extra);
}
extern "C" void __cyg_profile_func_exit(void* func, void* caller)
    __attribute__((no_instrument_function));
void __cyg_profile_func_exit(void* func, void* caller) {
    const char* func_name = "unknown";

#ifndef _WIN32
    Dl_info dlinfo{};
    if (dladdr(func, &dlinfo) && dlinfo.dli_sname) {
        func_name = demangle(dlinfo.dli_sname);
        if (dlinfo.dli_fname &&
            (strstr(dlinfo.dli_fname, "/usr/") ||
             strstr(dlinfo.dli_fname, "/lib/"))) {
            return;
        }
    }
#endif

    write_json_event("func_exit", func, func_name, --g_depth);
}

/* --------------------------------------------------------------------
   C++ HEAP TRACKING (new / delete)
   -------------------------------------------------------------------- */
void* operator new(std::size_t size) {
    void* ptr = std::malloc(size);
    if (ptr && g_depth > 0) {
        char extra[128];
        snprintf(extra, sizeof(extra), "\"size\":%zu", size);
        write_json_event("heap_alloc", ptr, "operator new", g_depth, extra);
    }
    return ptr;
}
void* operator new[](std::size_t size) {
    void* ptr = std::malloc(size);
    if (ptr && g_depth > 0) {
        char extra[128];
        snprintf(extra, sizeof(extra), "\"size\":%zu", size);
        write_json_event("heap_alloc", ptr, "operator new[]", g_depth, extra);
    }
    return ptr;
}
void operator delete(void* ptr) noexcept {
    if (ptr && g_depth > 0) {
        write_json_event("heap_free", ptr, "operator delete", g_depth);
    }
    std::free(ptr);
}
void operator delete[](void* ptr) noexcept {
    if (ptr && g_depth > 0) {
        write_json_event("heap_free", ptr, "operator delete[]", g_depth);
    }
    std::free(ptr);
}

/* --------------------------------------------------------------------
   C MALLOC / FREE TRACKING (POSIX only)
   -------------------------------------------------------------------- */
#if !defined(_WIN32)
extern "C" {
    static void* (*real_malloc)(std::size_t) = nullptr;
    static void (*real_free)(void*) = nullptr;

    static void init_malloc_hooks() __attribute__((constructor));
    static void init_malloc_hooks() {
        real_malloc = (void*(*)(std::size_t))dlsym(RTLD_NEXT, "malloc");
        real_free   = (void(*)(void*))dlsym(RTLD_NEXT, "free");
    }

    void* malloc(std::size_t size) __attribute__((no_instrument_function));
    void* malloc(std::size_t size) {
        if (!real_malloc) init_malloc_hooks();
        void* ptr = real_malloc(size);
        if (ptr && g_depth > 0 && g_trace_file) {
            char extra[128];
            snprintf(extra, sizeof(extra), "\"size\":%zu", size);
            write_json_event("heap_alloc", ptr, "malloc", g_depth, extra);
        }
        return ptr;
    }

    void free(void* ptr) __attribute__((no_instrument_function));
    void free(void* ptr) {
        if (!real_free) init_malloc_hooks();
        if (ptr && g_depth > 0 && g_trace_file) {
            write_json_event("heap_free", ptr, "free", g_depth);
        }
        real_free(ptr);
    }
}
#endif   // !_WIN32

/* --------------------------------------------------------------------
   TRACER LIFECYCLE (constructor / destructor)
   -------------------------------------------------------------------- */
extern "C" void __attribute__((constructor)) init_tracer()
    __attribute__((no_instrument_function));
void init_tracer() {
    const char* trace_path = std::getenv("TRACE_OUTPUT");
    if (!trace_path) trace_path = "trace.json";

    g_trace_file = std::fopen(trace_path, "w");
    if (g_trace_file) {
        std::fprintf(g_trace_file,
                     "{\"version\":\"1.0\",\"events\":[\n");
        std::fflush(g_trace_file);
    }
}
extern "C" void __attribute__((destructor)) finish_tracer()
    __attribute__((no_instrument_function));
void finish_tracer() {
    if (g_trace_file) {
        std::fprintf(g_trace_file,
                     "\n],\"total_events\":%lu}\n", g_event_counter);
        std::fclose(g_trace_file);
        g_trace_file = nullptr;
    }
}