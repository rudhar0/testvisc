#include <stdio.h>

/* Function declarations */
void showValues();
int addNumbers(int x, int y);
float getPi();

int main() {
    /* Declared only */
    int a, b;

    /* Initialized at declaration */
    int c = 10;
    int d = 10;   // same initial value

    /* Multiple initialization */
    int e = 5, f = 15, g = 25;

    /* Different data types */
    float radius = 4.0f;
    char grade = 'A';
    double salary = 50000.50;

    /* Updating variables */
    a = 20;
    b = 30;
    f = f + 10;

    printf("Main Function Output\n");
    printf("--------------------\n");
    printf("a = %d, b = %d\n", a, b);


/* Function definitions */

void showValues() {
    int x = 1, y = 2;     // multiple initialization
    x = x + 5;           // updated later

    printf("Inside showValues()\n");
    printf("x = %d, y = %d\n\n", x, y);
}

int addNumbers(int x, int y) {
    return x + y;
}

float getPi() {
    return 3.14f;
}
