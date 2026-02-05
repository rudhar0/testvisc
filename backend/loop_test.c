
#include <stdio.h>

int main() {
    int sum = 0;
    for (int i = 0; i < 3; i++) {
        sum += i;
        printf("Iteration %d, sum %d\n", i, sum);
    }
    printf("Final sum: %d\n", sum);
    return 0;
}
