import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getInspected,
  setInspected,
  subscribeInspected,
} from "../../src/core/devpanel/inspected";

afterEach(() => {
  setInspected(null);
});

describe("inspected store", () => {
  it("set/get l'élément courant", () => {
    const el = document.createElement("div");
    setInspected(el);
    expect(getInspected()).toBe(el);
    setInspected(null);
    expect(getInspected()).toBeNull();
  });

  it("notifie les abonnés, désabonnement propre", () => {
    const fn = vi.fn();
    const stop = subscribeInspected(fn);
    const el = document.createElement("span");
    setInspected(el);
    expect(fn).toHaveBeenCalledWith(el);

    stop();
    setInspected(document.createElement("p"));
    expect(fn).toHaveBeenCalledTimes(1); // plus notifié après stop
  });
});
