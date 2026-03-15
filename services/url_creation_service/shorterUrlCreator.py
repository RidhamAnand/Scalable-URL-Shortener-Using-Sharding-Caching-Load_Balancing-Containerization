from utilities import base62
from idGenerator import IDGenerator

def generate_short_url(long_url: str, machine_id: int, sequence_number: int) -> str:
    unique_id = IDGenerator(sequence_number)
    print("Unique ID: ", unique_id)
    short_url = base62.encode(machine_id,unique_id)
    return short_url