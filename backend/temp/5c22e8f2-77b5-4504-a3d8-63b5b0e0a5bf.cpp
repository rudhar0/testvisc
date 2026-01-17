#include <iostream>
using namespace std;

class Math {
public:
    int add(int a, int b) {
        return a + b;
    }
};

int main() {
    Math m;
    cout << m.add(3, 4) << endl;
    return 0;
}
