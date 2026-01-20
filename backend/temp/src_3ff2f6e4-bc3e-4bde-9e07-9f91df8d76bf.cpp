#include <iostream>
#include "trace.h"
using namespace std;

/* ---------- GLOBAL VARIABLES ---------- */
int g_uninit;                  // global uninitialized
int g_init = 10;               // global initialized
static int g_static = 20;      // static global

/* ---------- STRUCT ---------- */
struct Point {
    __trace_declare(x, int, 12);
    __trace_declare(y, int, 13);
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
    __trace_assign(z, x + y, 35);

    /* ---------- TYPE VARIATIONS ---------- */
    __trace_declare(f, float, 38);
    __trace_assign(f, 3.14f, 38);
    __trace_declare(d, double, 39);
    __trace_assign(d, 2.718, 39);
    char ch = 'A';
    __trace_declare(flag, bool, 41);
    __trace_assign(flag, true, 41);

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

    /* ---------- LOOP ---------- */
    __trace_declare(loopSum, int, 67);
    __trace_assign(loopSum, 0, 67);
    for (int i = 0; i < 3; i++) {
        __trace_declare(i, int, 68);
        __trace_assign(i, i, 68);
        loopSum += i;          // repeated update
    }

    /* ---------- CONDITIONAL ---------- */
    __trace_declare(maxVal, int, 73);
    if (a > b) {
        __trace_assign(maxVal, a, 75);
    } else {
        __trace_assign(maxVal, b, 77);
    }

    /* ---------- OUTPUT ---------- */
    cout << "sum=" << sum << endl;
    cout << "loopSum=" << loopSum << endl;
    cout << "maxVal=" << maxVal << endl;

    return 0;
}
