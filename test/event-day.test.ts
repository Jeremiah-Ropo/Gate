import { expect } from "chai";

import { calendarDay, isEventDay } from "../src/core/global/utils/event-day";

describe("isEventDay", () => {
  it("treats Lagos calendar dates as the event day", () => {
    const startsAt = new Date("2026-09-15T19:00:00.000Z");
    expect(isEventDay(startsAt, new Date("2026-09-15T08:00:00.000Z"))).to.equal(true);
    expect(isEventDay(startsAt, new Date("2026-09-14T20:00:00.000Z"))).to.equal(false);
    expect(isEventDay(startsAt, new Date("2026-09-16T00:30:00.000Z"))).to.equal(false);
  });

  it("formats as YYYY-MM-DD in Lagos", () => {
    expect(calendarDay(new Date("2026-09-15T23:30:00.000Z"))).to.equal("2026-09-16");
  });
});
