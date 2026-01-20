#include <stdio.h>
#include "trace.h"

int main() {
int a; int b; int a,b;
    int x = 10;
    TRACE_INT(x);

    if (x > 5) {
        printf("x is greater than 5\n");
    } else {
        printf("x is small\n");
    }

    return 0;
}
