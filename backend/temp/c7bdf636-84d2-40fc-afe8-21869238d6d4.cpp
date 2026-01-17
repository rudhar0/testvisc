#include <iostream>
using namespace std;

class Box {
public:
    int value;
};

int main() {
    Box *b = new Box();
    b->value = 20;

    cout << b->value << endl;

    delete b;
    return 0;
}
