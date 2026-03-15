# Convert Integer ID to Base62 String


BASE62_CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
BASE = 62


def encode(machine_id:str ,num: int) -> str:
    if num == 0:
        return BASE62_CHARS[0]

    encoded = []

    while num > 0:
        remainder = num % BASE
        encoded.append(BASE62_CHARS[remainder])
        num = num // BASE

    encoded.reverse()
    return machine_id + ''.join(encoded)


def decode(string: str) -> int:
    num = 0
    for char in string:
        num = num * BASE + BASE62_CHARS.index(char)
    return num

def decode(string: str) -> int:
    num = 0
    for char in string:
        num = num * BASE + BASE62_CHARS.index(char)
    return num

