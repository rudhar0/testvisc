#include "trace.h"
#i#include <stdio.h>

int square() {
    int x = 5;
    TRACE_INT(x);
    return x * x;
}

int main() {
    printf("Square = %d\n", square());
    return 0;
}
