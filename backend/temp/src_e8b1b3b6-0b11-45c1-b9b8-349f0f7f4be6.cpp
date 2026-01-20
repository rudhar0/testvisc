#include <iostream>
#include "trace.h"
using namespace std;

int main() {
    int a = 10;          // stack
    TRACE_INT(a);
    int *b = new int;    // heap
    *b = 20;

    cout << a << endl;
    cout << *b << endl;

    delete b;
    return 0;
}
