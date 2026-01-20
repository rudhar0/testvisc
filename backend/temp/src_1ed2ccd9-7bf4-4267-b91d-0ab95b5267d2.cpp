#include <iostream>
#include "trace.h"
using namespace std;

/* ---------- GLOBAL VARIABLES ---------- */
int g_uninit;                  // global uninitialized
int g_init = 10;               // global initialized
static int g_static = 20;      // static global

/* ---------- STRUCT ---------- */
struct Point {
    int x;
    TRACE_DECLARE("x", "int", __LINE__);
    int y;
    TRACE_DECLARE("y", "int", __LINE__);
};

/* ---------- FUNCTION ---------- */
int add(int a, int b) {
    int result = a + b;        // local initialized
    return result;
}

int main() {

    /* ---------- BASIC VARIABLES ---------- */
    int a;                     // local uninitialized
    a = 5;                     // assignment

    int b = 10;                // initialized
    b = b + 2;                 // update

    const int c = 7;           // const variable

    /* ---------- MULTIPLE DECLARATION ---------- */
    int x = 1, y = 2, z;       // mixed init
    z = x + y;
    TRACE_ASSIGN_INT("z", z, __LINE__);

    /* ---------- TYPE VARIATIONS ---------- */
    float f = 3.14f;
    TRACE_DECLARE("f", "float", __LINE__);
    TRACE_ASSIGN_DOUBLE("f", f, __LINE__);
    double d = 2.718;
    TRACE_DECLARE("d", "double", __LINE__);
    TRACE_ASSIGN_DOUBLE("d", d, __LINE__);
    char ch = 'A';
    TRACE_DECLARE("ch", "char", __LINE__);
    TRACE_ASSIGN_INT("ch", ch, __LINE__);
    bool flag = true;

    /* ---------- ARRAY ---------- */
    int arr[3];                // uninitialized array
    arr[0] = 10;
    arr[1] = 20;
    arr[2] = 30;

    /* ---------- POINTER ---------- */
    int *p = &a;               // pointer init
    *p = 15;                   // dereference update

    /* ---------- HEAP ---------- */
    int *heapVal = new int;    // heap allocation
    *heapVal = 99;             // heap write
    delete heapVal;            // heap free

    /* ---------- STRUCT VARIABLE ---------- */
    Point pt;                  // struct instance
    pt.x = 3;
    pt.y = 4;

    /* ---------- FUNCTION CALL ---------- */
    int sum = add(a, b);
    TRACE_DECLARE("sum", "int", __LINE__);
    int sum = add(a;
    TRACE_ASSIGN_INT("sum", sum, __LINE__);

    /* ---------- LOOP ---------- */
    int loopSum = 0;
    TRACE_DECLARE("loopSum", "int", __LINE__);
    TRACE_ASSIGN_INT("loopSum", loopSum, __LINE__);
    for (int i = 0; i < 3; i++) {
        TRACE_DECLARE("i", "int", __LINE__);
        TRACE_ASSIGN_INT("i", i, __LINE__);
        loopSum += i;          // repeated update
    }

    /* ---------- CONDITIONAL ---------- */
    int maxVal;
    TRACE_DECLARE("maxVal", "int", __LINE__);
    if (a > b) {
        maxVal = a;
        TRACE_ASSIGN_INT("maxVal", maxVal, __LINE__);
    } else {
        maxVal = b;
        TRACE_ASSIGN_INT("maxVal", maxVal, __LINE__);
    }

    /* ---------- OUTPUT ---------- */
    cout << "sum=" << sum << endl;
    TRACE_OUTPUT(__LINE__);
    cout << "loopSum=" << loopSum << endl;
    TRACE_OUTPUT(__LINE__);
    cout << "maxVal=" << maxVal << endl;
    TRACE_OUTPUT(__LINE__);

    return 0;
}
