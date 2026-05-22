import { Injectable } from '@nestjs/common';

@Injectable()
export class ClockService {
  private mockedTime: Date | null = null;

  /**
   * Sets a fixed time for deterministic testing and simulation.
   */
  setMockTime(date: Date) {
    this.mockedTime = date;
  }

  /**
   * Clears the mocked time, reverting to real system time.
   */
  clearMockTime() {
    this.mockedTime = null;
  }

  /**
   * Get the current deterministic timestamp in milliseconds.
   */
  now(): number {
    return this.mockedTime ? this.mockedTime.getTime() : Date.now();
  }

  /**
   * Get the current deterministic Date object.
   */
  getDate(): Date {
    return this.mockedTime ? new Date(this.mockedTime.getTime()) : new Date();
  }
}
