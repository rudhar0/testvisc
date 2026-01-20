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
    int y;
};

/* ---------- FUNCTION ---------- */
int add(int a, int b) {
    __trace_declare(result, int, 18);
    int result = a + b;        // local initialized
    __trace_assign(result, result, 18);
    return result;
}

int main() {

    /* ---------- BASIC VARIABLES ---------- */
    int a;                     // local uninitialized
    __trace_declare(a, int, 25);
    __trace_assign(a, 5, 26);
    a = 5;                     // assignment

    __trace_declare(b, int, 28);
    int b = 10;                // initialized
    __trace_assign(b, b, 28);
    __trace_assign(b, b + 2, 29);
    b = b + 2;                 // update

    const int c = 7;           // const variable

    /* ---------- MULTIPLE DECLARATION ---------- */
    __trace_declare(x, int, 34);
    int x = 1, y = 2, z;       // mixed init
    __trace_assign(x, x, 34);
    __trace_assign(z, x + y, 35);
    z = x + y;

    /* ---------- TYPE VARIATIONS ---------- */
    __trace_declare(f, float, 38);
    float f = 3.14f;
    __trace_assign(f, f, 38);
    __trace_declare(d, double, 39);
    double d = 2.718;
    __trace_assign(d, d, 39);
    __trace_declare(ch, char, 40);
    char ch = 'A';
    __trace_assign(ch, ch, 40);
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
    __trace_declare(sum, int, 64);
    int sum = add(a, b);
    __trace_assign(sum, sum, 64);

    /* ---------- LOOP ---------- */
    __trace_declare(loopSum, int, 67);
    int loopSum = 0;
    __trace_assign(loopSum, loopSum, 67);
    for (int i = 0; i < 3; i++) {
        __trace_assign(loopSum, loopSum + i, 69);
        loopSum += i;          // repeated update
    }

    /* ---------- CONDITIONAL ---------- */
    int maxVal;
    __trace_declare(maxVal, int, 73);
    if (a > b) {
        __trace_assign(maxVal, a, 75);
        maxVal = a;
    } else {
        __trace_assign(maxVal, b, 77);
        maxVal = b;
    }

    /* ---------- OUTPUT ---------- */
    cout << "sum=" << sum << endl;
    cout << "loopSum=" << loopSum << endl;
    cout << "maxVal=" << maxVal << endl;

    return 0;
}
