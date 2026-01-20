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
    TRACE_INT(x);
    int y;
    TRACE_INT(y);
};

/* ---------- FUNCTION ---------- */
int add(int a, int b) {
    int result = a + b;        // local initialized
    TRACE_INT(result);
    return result;
    TRACE_INT(result);
}

int main() {

    /* ---------- BASIC VARIABLES ---------- */
    int a;                     // local uninitialized
    a = 5;                     // assignment
    TRACE_INT(a);

    int b = 10;                // initialized
    TRACE_INT(b);
    b = b + 2;                 // update
    TRACE_INT(b);

    const int c = 7;           // const variable

    /* ---------- MULTIPLE DECLARATION ---------- */
    int x = 1, y = 2, z;       // mixed init
    TRACE_INT(x);
    z = x + y;
    TRACE_INT(z);

    /* ---------- TYPE VARIATIONS ---------- */
    float f = 3.14f;
    TRACE_DOUBLE(f);
    double d = 2.718;
    TRACE_DOUBLE(d);
    char ch = 'A';
    TRACE_INT(ch);
    bool flag = true;
    TRACE_INT(flag);

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
    TRACE_INT(sum);

    /* ---------- LOOP ---------- */
    int loopSum = 0;
    TRACE_INT(loopSum);
    for (int i = 0; i < 3; i++) {
        TRACE_INT(i);
        loopSum += i;          // repeated update
        TRACE_INT(loopSum);
    }

    /* ---------- CONDITIONAL ---------- */
    int maxVal;
    TRACE_INT(maxVal);
    if (a > b) {
        maxVal = a;
        TRACE_INT(maxVal);
    } else {
        maxVal = b;
        TRACE_INT(maxVal);
    }

    /* ---------- OUTPUT ---------- */
    cout << "sum=" << sum << endl;
    cout << "loopSum=" << loopSum << endl;
    cout << "maxVal=" << maxVal << endl;

    return 0;
}
