import { Injectable } from '@nestjs/common';
import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';

@Injectable()
export class IdService {
  private deterministicMode = false;
  private namespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // standard DNS namespace
  private counter = 0;

  enableDeterministicMode() {
    this.deterministicMode = true;
    this.counter = 0;
  }

  disableDeterministicMode() {
    this.deterministicMode = false;
  }

  generateUuid(): string {
    if (this.deterministicMode) {
      this.counter++;
      // Generates a predictable UUIDv5 based on counter to guarantee determinism
      return uuidv5(`deterministic-id-${this.counter}`, this.namespace);
    }
    return uuidv4();
  }
}
