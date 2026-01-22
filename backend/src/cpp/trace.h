// src/cpp/trace.h
#pragma once

#include <cstdio>
#include <cstdlib>

#ifdef _WIN32
/* -------------------------- Windows prototypes -------------------------- */
#ifdef __cplusplus
extern "C" {
#endif

/* Location-aware versions – these are what the instrumented code calls */
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

/* Backward-compatible (no location) wrappers – kept for hand-written code */
void trace_var_int(const char* name, int value);
void trace_var_long(const char* name, long long value);
void trace_var_double(const char* name, double value);
void trace_var_ptr(const char* name, void* value);
void trace_var_str(const char* name, const char* value);

/* ✅ NEW: Beginner-mode helpers for explicit declaration/assignment steps */
void __trace_declare_loc(const char* name, const char* type,
                         const char* file, int line);
void __trace_assign_loc(const char* name, long long value,
                        const char* file, int line);

/* ✅ NEW: Array tracking functions */
void __trace_array_create_loc(const char* name, const char* baseType,
                               void* address, int dim1, int dim2, int dim3,
                               const char* file, int line);
void __trace_array_init_loc(const char* name, void* values, int count,
                             const char* file, int line);
void __trace_array_index_assign_loc(const char* name, int idx1, int idx2, int idx3,
                                     long long value, const char* file, int line);
void __trace_array_reference_loc(const char* fromVar, const char* toArray,
                                  const char* fromFunc, const char* toFunc,
                                  const char* file, int line);
void __trace_pointer_maps_array_loc(const char* pointerName, const char* arrayName,
                                     const char* file, int line);
void __trace_array_pass_reference_loc(const char* pointer, const char* targetArray,
                                       const char* scope, const char* file, int line);

#ifdef __cplusplus
}
#endif

/* Macros forward to the location-aware implementations */
#define TRACE_INT(var)    trace_var_int_loc(#var,   (int)(var),   __FILE__, __LINE__)
#define TRACE_LONG(var)   trace_var_long_loc(#var,  (long long)(var), __FILE__, __LINE__)
#define TRACE_DOUBLE(var) trace_var_double_loc(#var,(double)(var), __FILE__, __LINE__)
#define TRACE_PTR(var)    trace_var_ptr_loc(#var,   (void*)(var), __FILE__, __LINE__)
#define TRACE_STR(var)    trace_var_str_loc(#var,   (const char*)(var), __FILE__, __LINE__)
#define TRACE_VAR(var)    TRACE_INT(var)

/* ✅ NEW: Beginner-mode macros that capture __FILE__ automatically */
#define __trace_declare(name, type, line) \
    __trace_declare_loc(#name, #type, __FILE__, line)
#define __trace_assign(name, value, line) \
    __trace_assign_loc(#name, (long long)(value), __FILE__, line)

/* ✅ NEW: Array macros */
#define __trace_array_create(name, baseType, dim1, dim2, dim3, line) \
    __trace_array_create_loc(#name, #baseType, (void*)(name), dim1, dim2, dim3, __FILE__, line)
#define __trace_array_init(name, values, count, line) \
    __trace_array_init_loc(#name, (void*)(values), count, __FILE__, line)
#define __trace_array_index_assign_1d(name, idx, value, line) \
    __trace_array_index_assign_loc(#name, idx, -1, -1, (long long)(value), __FILE__, line)
#define __trace_array_index_assign_2d(name, idx1, idx2, value, line) \
    __trace_array_index_assign_loc(#name, idx1, idx2, -1, (long long)(value), __FILE__, line)
#define __trace_array_index_assign_3d(name, idx1, idx2, idx3, value, line) \
    __trace_array_index_assign_loc(#name, idx1, idx2, idx3, (long long)(value), __FILE__, line)
#define __trace_array_reference(fromVar, toArray, fromFunc, toFunc, line) \
    __trace_array_reference_loc(#fromVar, #toArray, fromFunc, toFunc, __FILE__, line)
#define __trace_pointer_maps_array(pointerName, arrayName, line) \
    __trace_pointer_maps_array_loc(#pointerName, #arrayName, __FILE__, line)
#define __trace_array_pass_reference(pointer, targetArray, scope, line) \
    __trace_array_pass_reference_loc(#pointer, #targetArray, scope, __FILE__, line)

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

/* Backward-compatible wrappers */
void trace_var_int(const char* name, int value);
void trace_var_long(const char* name, long long value);
void trace_var_double(const char* name, double value);
void trace_var_ptr(const char* name, void* value);
void trace_var_str(const char* name, const char* value);

/* ✅ NEW: Beginner-mode helpers for explicit declaration/assignment steps */
void __trace_declare_loc(const char* name, const char* type,
                         const char* file, int line);
void __trace_assign_loc(const char* name, long long value,
                        const char* file, int line);

/* ✅ NEW: Array tracking functions */
void __trace_array_create_loc(const char* name, const char* baseType,
                               void* address, int dim1, int dim2, int dim3,
                               const char* file, int line);
void __trace_array_init_loc(const char* name, void* values, int count,
                             const char* file, int line);
void __trace_array_index_assign_loc(const char* name, int idx1, int idx2, int idx3,
                                     long long value, const char* file, int line);
void __trace_array_reference_loc(const char* fromVar, const char* toArray,
                                  const char* fromFunc, const char* toFunc,
                                  const char* file, int line);

#ifdef __cplusplus
}
#endif

#define TRACE_INT(var)    trace_var_int_loc(#var,   (int)(var),   __FILE__, __LINE__)
#define TRACE_LONG(var)   trace_var_long_loc(#var,  (long long)(var), __FILE__, __LINE__)
#define TRACE_DOUBLE(var) trace_var_double_loc(#var,(double)(var), __FILE__, __LINE__)
#define TRACE_PTR(var)    trace_var_ptr_loc(#var,   (void*)(var), __FILE__, __LINE__)
#define TRACE_STR(var)    trace_var_str_loc(#var,   (const char*)(var), __FILE__, __LINE__)
#define TRACE_VAR(var)    TRACE_INT(var)

/* ✅ NEW: Beginner-mode macros that capture __FILE__ automatically */
#define __trace_declare(name, type, line) \
    __trace_declare_loc(#name, #type, __FILE__, line)
#define __trace_assign(name, value, line) \
    __trace_assign_loc(#name, (long long)(value), __FILE__, line)

/* ✅ NEW: Array macros */
#define __trace_array_create(name, baseType, dim1, dim2, dim3, line) \
    __trace_array_create_loc(#name, #baseType, (void*)(name), dim1, dim2, dim3, __FILE__, line)
#define __trace_array_init(name, values, count, line) \
    __trace_array_init_loc(#name, (void*)(values), count, __FILE__, line)
#define __trace_array_index_assign_1d(name, idx, value, line) \
    __trace_array_index_assign_loc(#name, idx, -1, -1, (long long)(value), __FILE__, line)
#define __trace_array_index_assign_2d(name, idx1, idx2, value, line) \
    __trace_array_index_loc(#name, idx1, idx2, -1, (long long)(value), __FILE__, line)
#define __trace_array_index_assign_3d(name, idx1, idx2, idx3, value, line) \
    __trace_array_index_assign_loc(#name, idx1, idx2, idx3, (long long)(value), __FILE__, line)
#define __trace_array_reference(fromVar, toArray, fromFunc, toFunc, line) \
    __trace_array_reference_loc(#fromVar, #toArray, fromFunc, toFunc, __FILE__, line)

#endif   /* _WIN32 */