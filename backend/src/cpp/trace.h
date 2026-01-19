// src/cpp/trace.h
#pragma once

#include <cstdio>
#include <cstdlib>

#ifdef _WIN32
/* -------------------------- Windows prototypes -------------------------- */
#ifdef __cplusplus
extern "C" {
#endif

/* Location‑aware versions – these are what the instrumented code calls */
void trace_var_int_loc(const char* name, int value,
                       const char* file, int line);
void trace_var_long_loc(const char* name, long long value,
                        const char* file, int line);
void trace_var_double_loc(const char* name, double value,
                          const char* file, int line);
void trace_var_ptr_loc(const char* name, void* value,
                       const char* file, int line);
void trace_var_str_loc(const char* name, const char* value,
                       const char* file, int line);

/* Backward‑compatible (no location) wrappers – kept for hand‑written code */
void trace_var_int(const char* name, int value);
void trace_var_long(const char* name, long long value);
void trace_var_double(const char* name, double value);
void trace_var_ptr(const char* name, void* value);
void trace_var_str(const char* name, const char* value);

#ifdef __cplusplus
}
#endif

/* Macros forward to the location‑aware implementations */
#define TRACE_INT(var)    trace_var_int_loc(#var,   (int)(var),   __FILE__, __LINE__)
#define TRACE_LONG(var)   trace_var_long_loc(#var,  (long long)(var), __FILE__, __LINE__)
#define TRACE_DOUBLE(var) trace_var_double_loc(#var,(double)(var), __FILE__, __LINE__)
#define TRACE_PTR(var)    trace_var_ptr_loc(#var,   (void*)(var), __FILE__, __LINE__)
#define TRACE_STR(var)    trace_var_str_loc(#var,   (const char*)(var), __FILE__, __LINE__)
#define TRACE_VAR(var)    TRACE_INT(var)

#else   /* --------------------------- POSIX prototypes --------------------------- */

#ifdef __cplusplus
extern "C" {
#endif

void trace_var_int_loc(const char* name, int value,
                       const char* file, int line);
void trace_var_long_loc(const char* name, long long value,
                        const char* file, int line);
void trace_var_double_loc(const char* name, double value,
                          const char* file, int line);
void trace_var_ptr_loc(const char* name, void* value,
                       const char* file, int line);
void trace_var_str_loc(const char* name, const char* value,
                       const char* file, int line);

/* Backward‑compatible wrappers */
void trace_var_int(const char* name, int value);
void trace_var_long(const char* name, long long value);
void trace_var_double(const char* name, double value);
void trace_var_ptr(const char* name, void* value);
void trace_var_str(const char* name, const char* value);

#ifdef __cplusplus
}
#endif

#define TRACE_INT(var)    trace_var_int_loc(#var,   (int)(var),   __FILE__, __LINE__)
#define TRACE_LONG(var)   trace_var_long_loc(#var,  (long long)(var), __FILE__, __LINE__)
#define TRACE_DOUBLE(var) trace_var_double_loc(#var,(double)(var), __FILE__, __LINE__)
#define TRACE_PTR(var)    trace_var_ptr_loc(#var,   (void*)(var), __FILE__, __LINE__)
#define TRACE_STR(var)    trace_var_str_loc(#var,   (const char*)(var), __FILE__, __LINE__)
#define TRACE_VAR(var)    TRACE_INT(var)

#endif   /* _WIN32 */
