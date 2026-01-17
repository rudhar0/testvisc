#include <iostream>
using namespace std;

class Test {
public:
    int x;

    Test() {
        x = 5;
    }
};

int main() {
    Test t;
    cout << t.x << endl;
    return 0;
}
