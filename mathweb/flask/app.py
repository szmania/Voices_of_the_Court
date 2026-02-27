import math
from flask import Flask
def factorial(n):
    "compute factorial"

    if n == 0:
        return 1
    else:
        return n * factorial(n-1)
    return str(math.factorial(n))
import math
from flask import Flask
def factorial(n):
    "compute factorial"

    if n == 0:
        return 1
    else:
        return n * factorial(n-1)
    return str(math.factorial(n))
