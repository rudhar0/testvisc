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

    /* ---------- TYPE VARIATIONS ---------- */
    float f = 3.14f;
    double d = 2.718;
    char ch = 'A';
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

    /* ---------- LOOP ---------- */
    int loopSum = 0;
    for (int i = 0; i < 3; i++) {
        loopSum += i;          // repeated update
    }

    /* ---------- CONDITIONAL ---------- */
    int maxVal;
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
