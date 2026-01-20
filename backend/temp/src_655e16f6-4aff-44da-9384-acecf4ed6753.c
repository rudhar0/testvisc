#include <stdio.h>
#include "trace.h"

int main() {

    int a;          // declared only
    int c = 10;        // initialized
    TRACE_INT(c);
    int d = 10;        // same initial
    TRACE_INT(d);
    int e = 1, f = 2;  // multiple init
    TRACE_INT(e);

    a = 5;
    TRACE_INT(a);

    c = c + 5;
    TRACE_INT(c);

    printf("a=%d b=%d c=%d d=%d e=%d f=%d\n", a, b, c, d, e, f);
    return 0;
}
