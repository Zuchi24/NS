import { describe, expect, it } from "vitest";

import contract from "@/features/simulations/cableWiring/contract/cable-contract.v1.json";
import {
  isPhysicalConfig,
  parsePhysicalChallengeConfig,
} from "@/features/simulations/cableWiring/integration/publicConfig";
import type { SimulationConfig } from "./types";

/**
 * The two shapes a challenge's `config` arrives in, and the one field that
 * tells them apart.
 *
 * What each half of this can honestly check is different, and deliberately so.
 * The guided branch names its fields, so assigning to it is a real structural
 * check. The physical branch names only `model`: its body is wire data, and
 * parsePhysicalChallengeConfig() is the one thing entitled to call that well
 * formed. So nothing here asserts a scenario's shape — a config must not be
 * able to reach the bench on a type's say-so, and the last test below is what
 * holds that line.
 *
 * The configs come from the frozen contract (§8) rather than from shapes
 * written here, so this is checked against what the server actually sends.
 */

/**
 * S1's public config, as the contract carries it.
 *
 * `model` is restated because importing the JSON as a module widens its
 * `"physical"` to `string`; the spread keeps the scenario and assist exactly as
 * the contract has them.
 */
const S1 = contract.scenarios.S1.public_config;
const s1Config: SimulationConfig = { ...S1, model: "physical" };

/** What the legacy `rj45_order` rule is projected to, and always has been. */
const LEGACY = { standard: "T568B", cable: "straight" } as const;

describe("the shape of a challenge's simulation config", () => {
  it("takes the legacy and assembly configs on the guided branch", () => {
    // These assignments are the assertion: the guided branch names its fields,
    // so a type that stopped describing them would stop compiling here.
    const legacy: SimulationConfig = LEGACY;
    const assembly: SimulationConfig = { components: ["motherboard", "cpu"] };

    expect(legacy.model).toBeUndefined();
    expect(assembly.model).toBeUndefined();
    expect(isPhysicalConfig(legacy)).toBe(false);
    expect(isPhysicalConfig(assembly)).toBe(false);
  });

  it("takes the contract's own physical config on the physical branch", () => {
    expect(s1Config.model).toBe("physical");
    expect(isPhysicalConfig(s1Config)).toBe(true);

    // The contract's discriminator and the type's are the same field: a
    // scenario whose public config stopped carrying it would fail here.
    for (const key of Object.keys(contract.scenarios)) {
      const config = contract.scenarios[key as keyof typeof contract.scenarios].public_config;

      expect(config.model, `${key}.public_config.model`).toBe("physical");
      expect(isPhysicalConfig(config), key).toBe(true);
    }
  });

  it("lets a caller read either branch's own fields off the union", () => {
    // The two readers in the app do exactly this and neither narrows first:
    // the legacy bench reads `cable`, the assembly page reads `components`.
    // Both must keep compiling against the union.
    const configs: (SimulationConfig | null)[] = [LEGACY, { components: ["cpu"] }, s1Config, null];

    expect(configs.map((config) => config?.cable ?? "straight")).toEqual([
      "straight",
      "straight",
      "straight",
      "straight",
    ]);
    expect(configs.map((config) => config?.components?.length ?? 0)).toEqual([0, 1, 0, 0]);
  });

  it("narrows on `model`, which is what makes it a union rather than one loose shape", () => {
    const config: SimulationConfig = s1Config;

    if (config.model === "physical") {
      // Inside the narrowing the physical fields are present and the guided
      // ones are gone. `cable` is `never` here, which is the whole point.
      expect(config.scenario).toBeTypeOf("object");
      expect(config.assist).not.toBeUndefined();
      expect(config.cable).toBeUndefined();
    } else {
      throw new Error("S1's public config must take the physical branch");
    }
  });

  it("leaves the parser as the only thing that may call a physical config well formed", () => {
    // Typed as the physical branch and still refused, because the type says
    // nothing about the scenario's contents.
    const malformed: SimulationConfig = { model: "physical", scenario: { id: "" }, assist: null };

    expect(isPhysicalConfig(malformed)).toBe(true);
    expect(parsePhysicalChallengeConfig(malformed).ok).toBe(false);

    // And the contract's own config passes that same parser.
    expect(parsePhysicalChallengeConfig(S1).ok).toBe(true);
  });
});
