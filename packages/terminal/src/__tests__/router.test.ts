import { describe, test, expect } from "bun:test";
import { SceneRouter } from "../scene/router.ts";
import type { Scene, SceneContext, SceneSignal } from "../scene/types.ts";
import type { CellBuffer } from "../render/buffer.ts";
import type { KeyEvent } from "../input/key-parser.ts";

/** Minimal test scene that returns a fixed signal on first key */
function makeScene(signal?: SceneSignal): Scene {
  return {
    update(_elapsed: number, _dt: number, _ctx: SceneContext) {},
    render(_frame: CellBuffer, _ctx: SceneContext) {},
    handleKey(_key: KeyEvent, _ctx: SceneContext) {
      return signal;
    },
  };
}

describe("SceneRouter", () => {
  test("current returns the initial scene", () => {
    const scene = makeScene();
    const router = new SceneRouter(scene, () => makeScene());
    expect(router.current()).toBe(scene);
  });

  test("push adds scene to top of stack", () => {
    const s1 = makeScene();
    const s2 = makeScene();
    const router = new SceneRouter(s1, () => makeScene());
    router.push(s2);
    expect(router.current()).toBe(s2);
  });

  test("pop removes top scene and returns it", () => {
    const s1 = makeScene();
    const s2 = makeScene();
    const router = new SceneRouter(s1, () => makeScene());
    router.push(s2);
    const popped = router.pop();
    expect(popped).toBe(s2);
    expect(router.current()).toBe(s1);
  });

  test("pop returns undefined if only one scene", () => {
    const router = new SceneRouter(makeScene(), () => makeScene());
    expect(router.pop()).toBeUndefined();
  });

  test("replace swaps current scene", () => {
    const s1 = makeScene();
    const s2 = makeScene();
    const router = new SceneRouter(s1, () => makeScene());
    router.replace(s2);
    expect(router.current()).toBe(s2);
  });
});
