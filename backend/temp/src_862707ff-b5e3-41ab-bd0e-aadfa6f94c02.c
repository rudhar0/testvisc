#include <stdio.h>
#include "trace.h"

int main() {

    int a;          // declared only
   // initialized
    int d = 10;  
    TRACE_INT(d);
    int ab,ddf;       // same initial
    int e = 1, f = 2;  // multiple init
    TRACE_INT(e);

    a = 5;
    TRACE_INT(a);

    c = c + 5;
    TRACE_INT(c);

    printf("a=%d b=%d c=%d d=%d e=%d f=%d\n", a, c, d, e, f);
    return 0;
}
