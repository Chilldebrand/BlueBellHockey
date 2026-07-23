import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_AUDIO_PREFERENCES, type AudioPreferences } from "../audio/preferences.js";
import { AudioSettings } from "./AudioSettings.js";

function getInputElements(node: unknown): Array<{
  readonly type: string;
  readonly props: Record<string, unknown>;
}> {
  if (!node || typeof node !== "object") {
    return [];
  }

  const element = node as {
    readonly type?: string;
    readonly props?: { readonly children?: unknown };
  };
  const children = element.props?.children;
  const childNodes = Array.isArray(children) ? children : [children];
  const nested = childNodes.flatMap((child) => getInputElements(child));

  return element.type === "input" ? [element as never, ...nested] : nested;
}

describe("AudioSettings", () => {
  it("renders three labeled range inputs with percentages", () => {
    const html = renderToStaticMarkup(
      <AudioSettings
        value={DEFAULT_AUDIO_PREFERENCES}
        onChange={vi.fn()}
      />
    );

    expect(html).toContain(">Announcer<");
    expect(html).toContain(">Gameplay<");
    expect(html).toContain(">Music<");
    expect(html).toContain('aria-label="Announcer"');
    expect(html).toContain('aria-label="Gameplay"');
    expect(html).toContain('aria-label="Music"');
    expect(html).toContain('type="range"');
    expect(html).toContain('min="0"');
    expect(html).toContain('max="100"');
    expect(html).toContain('step="1"');
    expect(html).toContain(">93%<");
    expect(html).toContain(">82%<");
  });

  it("preserves the other buses when one slider changes", () => {
    const onChange = vi.fn();
    const value: AudioPreferences = {
      announcer: 0.8,
      gameplay: 0.4,
      music: 0.55
    };

    const tree = AudioSettings({ value, onChange });
    const announcerInput = getInputElements(tree).find(
      (input) => input.props["aria-label"] === "Announcer"
    );

    if (!announcerInput) {
      throw new Error("Expected announcer input");
    }

    const handleChange = announcerInput.props.onChange as (
      event: { currentTarget: { value: string } }
    ) => void;
    handleChange({ currentTarget: { value: "12" } });

    expect(onChange).toHaveBeenCalledWith({
      announcer: 0.12,
      gameplay: 0.4,
      music: 0.55
    });
  });
});
