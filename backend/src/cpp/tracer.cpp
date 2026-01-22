// src/cpp/tracer.cpp
// ------------------------------------------------------------
// Cross-platform instrumentation tracer (C & C++)
// ✅ ENHANCED: Full array support with native events
// ------------------------------------------------------------

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <ctime>
#include <cstddef>
#include <algorithm>
#include <string>
#include <map>

#ifdef _WIN32
    #include <windows.h>
#else
    #include <dlfcn.h>
    #include <cxxabi.h>
    #include <sys/time.h>
    #include <unistd.h>
    #include <mutex>
#endif

#include "trace.h"

// --------------------------------------------------------------------
// Global state
// --------------------------------------------------------------------
static FILE*   g_trace_file    = nullptr;
static int     g_depth         = 0;
static unsigned long g_event_counter = 0;

#ifndef _WIN32
static std::mutex g_trace_mutex;
#endif

// ✅ NEW: Array tracking registry
struct ArrayInfo {
    std::string name;
    std::string baseType;
    void* address;
    int dim1, dim2, dim3;
    std::string ownerFunc;
};

// ✅ NEW: Track array element values to filter duplicates
struct ArrayElementKey {
    std::string arrayName;
    int idx1, idx2, idx3;
    
    bool operator<(const ArrayElementKey& other) const {
        if (arrayName != other.arrayName) return arrayName < other.arrayName;
        if (idx1 != other.idx1) return idx1 < other.idx1;
        if (idx2 != other.idx2) return idx2 < other.idx2;
        return idx3 < other.idx3;
    }
};

static std::map<void*, ArrayInfo> g_array_registry;
static std::map<void*, void*> g_pointer_to_array;  // pointer addr -> array addr
static std::map<std::string, std::string> g_pointer_name_to_array_name; // NEW: name mapping
static std::string g_current_function = "main"; // Track current function scope
static std::map<ArrayElementKey, long long> g_array_element_values; // Track element values

// --------------------------------------------------------------------
// Helper functions
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
    return name;
#endif
}

static std::string json_safe_path(const char* raw) {
    if (!raw) return "";
    std::string s(raw);
    std::replace(s.begin(), s.end(), '\\', '/');
    return s;
}

// ✅ NEW: Normalize function names (strip \r \n)
static std::string normalize_function_name(const char* name) {
    if (!name) return "unknown";
    std::string s(name);
    s.erase(std::remove(s.begin(), s.end(), '\r'), s.end());
    s.erase(std::remove(s.begin(), s.end(), '\n'), s.end());
    return s;
}

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

// --------------------------------------------------------------------
// ✅ NEW: Array tracking implementations
// --------------------------------------------------------------------

extern "C" void __trace_array_create_loc(const char* name, const char* baseType,
                                         void* address, int dim1, int dim2, int dim3,
                                         const char* file, int line) {
    if (!g_trace_file) return;
    
    const std::string f = json_safe_path(file);
    char extra[512];
    
    // Build dimensions array
    char dims[64];
    if (dim3 > 0) {
        snprintf(dims, sizeof(dims), "[%d,%d,%d]", dim1, dim2, dim3);
    } else if (dim2 > 0) {
        snprintf(dims, sizeof(dims), "[%d,%d]", dim1, dim2);
    } else {
        snprintf(dims, sizeof(dims), "[%d]", dim1);
    }
    
    snprintf(extra, sizeof(extra),
             "\"name\":\"%s\",\"baseType\":\"%s\",\"dimensions\":%s,\"isStackArray\":true,\"ownerFunction\":\"%s\",\"file\":\"%s\",\"line\":%d",
             name, baseType, dims, g_current_function.c_str(), f.c_str(), line);
    
    write_json_event("array_create", address, g_current_function.c_str(), g_depth, extra);
    
    // Register array
    ArrayInfo info;
    info.name = name;
    info.baseType = baseType;
    info.address = address;
    info.dim1 = dim1;
    info.dim2 = dim2;
    info.dim3 = dim3;
    info.ownerFunc = g_current_function;
    
    g_array_registry[address] = info;
}

extern "C" void __trace_array_init_loc(const char* name, void* values, int count,
                                       const char* file, int line) {
    if (!g_trace_file) return;
    
    const std::string f = json_safe_path(file);
    
    // Convert values to JSON array
    int* intValues = static_cast<int*>(values);
    char valueStr[1024] = "[";
    char temp[32];
    for (int i = 0; i < count && i < 100; i++) {
        if (i > 0) strcat(valueStr, ",");
        snprintf(temp, sizeof(temp), "%d", intValues[i]);
        strcat(valueStr, temp);
    }
    strcat(valueStr, "]");
    
    char extra[2048];
    snprintf(extra, sizeof(extra),
             "\"name\":\"%s\",\"values\":%s,\"file\":\"%s\",\"line\":%d",
             name, valueStr, f.c_str(), line);
    
    write_json_event("array_init", values, g_current_function.c_str(), g_depth, extra);
}

extern "C" void __trace_array_index_assign_loc(const char* name, int idx1, int idx2, int idx3,
                                                long long value, const char* file, int line) {
    if (!g_trace_file) return;
    
    // ✅ NEW: Check if value actually changed
    ArrayElementKey key;
    key.arrayName = name;
    key.idx1 = idx1;
    key.idx2 = idx2;
    key.idx3 = idx3;
    
    auto it = g_array_element_values.find(key);
    if (it != g_array_element_values.end() && it->second == value) {
        // Value unchanged - skip event
        return;
    }
    
    // Update tracked value
    g_array_element_values[key] = value;
    
    const std::string f = json_safe_path(file);
    
    // Build indices array
    char indices[64];
    if (idx3 >= 0) {
        snprintf(indices, sizeof(indices), "[%d,%d,%d]", idx1, idx2, idx3);
    } else if (idx2 >= 0) {
        snprintf(indices, sizeof(indices), "[%d,%d]", idx1, idx2);
    } else {
        snprintf(indices, sizeof(indices), "[%d]", idx1);
    }
    
    char extra[512];
    snprintf(extra, sizeof(extra),
             "\"name\":\"%s\",\"indices\":%s,\"value\":%lld,\"file\":\"%s\",\"line\":%d",
             name, indices, value, f.c_str(), line);
    
    write_json_event("array_index_assign", nullptr, g_current_function.c_str(), g_depth, extra);
}

extern "C" void __trace_array_reference_loc(const char* fromVar, const char* toArray,
                                            const char* fromFunc, const char* toFunc,
                                            const char* file, int line) {
    if (!g_trace_file) return;
    
    const std::string f = json_safe_path(file);
    char extra[512];
    snprintf(extra, sizeof(extra),
             "\"fromVariable\":\"%s\",\"toArray\":\"%s\",\"fromFunction\":\"%s\",\"toFunction\":\"%s\",\"file\":\"%s\",\"line\":%d",
             fromVar, toArray, fromFunc, toFunc, f.c_str(), line);
    
    write_json_event("array_reference", nullptr, "array_ref", g_depth, extra);
}

// ✅ NEW: Map pointer name to array name for index resolution
extern "C" void __trace_pointer_maps_array_loc(const char* pointerName, const char* arrayName,
                                                const char* file, int line) {
    if (!g_trace_file) return;
    
    g_pointer_name_to_array_name[pointerName] = arrayName;
    
    // Also emit as internal tracking event (won't create a step)
    const std::string f = json_safe_path(file);
    char extra[256];
    snprintf(extra, sizeof(extra),
             "\"pointer\":\"%s\",\"array\":\"%s\",\"file\":\"%s\",\"line\":%d",
             pointerName, arrayName, f.c_str(), line);
    
    write_json_event("pointer_array_map", nullptr, "internal", g_depth, extra);
}

// ✅ NEW: Explicit array pass reference event (pointer = array)
extern "C" void __trace_array_pass_reference_loc(const char* pointer, const char* targetArray,
                                                  const char* scope, const char* file, int line) {
    if (!g_trace_file) return;
    
    const std::string f = json_safe_path(file);
    char extra[512];
    snprintf(extra, sizeof(extra),
             "\"pointer\":\"%s\",\"targetArray\":\"%s\",\"scope\":\"%s\",\"file\":\"%s\",\"line\":%d",
             pointer, targetArray, scope, f.c_str(), line);
    
    write_json_event("array_pass_reference", nullptr, g_current_function.c_str(), g_depth, extra);
}

// --------------------------------------------------------------------
// Existing implementations (UNCHANGED)
// --------------------------------------------------------------------

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

// Function entry/exit, heap tracking, lifecycle - ALL UNCHANGED
extern "C" void __cyg_profile_func_enter(void* func, void* caller)
    __attribute__((no_instrument_function));
void __cyg_profile_func_enter(void* func, void* caller) {
    const char* func_name = "unknown";

#ifndef _WIN32
    Dl_info dlinfo{};
    if (dladdr(func, &dlinfo) && dlinfo.dli_sname) {
        func_name = demangle(dlinfo.dli_sname);
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
#endif

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