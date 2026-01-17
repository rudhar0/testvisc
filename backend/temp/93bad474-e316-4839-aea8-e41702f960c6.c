#include <stdio.h>

int main() {
    /* Declared only */
    int a, b;

    /* Initialized at declaration */
    int c = 10;
    int d = 10;        // same initial value as c

    /* Multiple initialization */
    int e = 5, f = 15, g = 25;

    /* Different data types */
    float pi = 3.14f;
    char grade = 'A';
    double salary = 45000.75;

    /* Updating variables */
    a = 20;
    b = 30;
    c = c + 5;
    f = f - 5;

    printf("Value of a: %d\n", a);
    printf("Value of b: %d\n", b);
    printf("Value of c (updated): %d\n", c);
    printf("Value of d (same initial): %d\n", d);

    printf("Value of e: %d\n", e);
    printf("Value of f (updated): %d\n", f);
    printf("Value of g: %d\n", g);

    printf("Value of pi: %.2f\n", pi);
    printf("Grade: %c\n", grade);
    printf("Salary: %.2lf\n", salary);

    return 0;
}
