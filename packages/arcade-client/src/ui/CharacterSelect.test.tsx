import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CharacterSelect } from "./CharacterSelect.js";

describe("CharacterSelect", () => {
  it("renders original characters, stats, specials, and selected state", () => {
    const html = renderToStaticMarkup(
      <CharacterSelect
        selectedCharacterId="rook-rocket"
        headline="Pick for Ada"
        disabled={false}
        onChooseCharacter={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(html).toContain("Pick for Ada");
    expect(html).toContain("Rook Rocket");
    expect(html).toContain("Rocket Burst");
    expect(html).toContain("speed");
    expect(html).toContain("Selected");
    expect(html).toContain("Done");
    expect(html).not.toMatch(/\b(nhl|gretzky|crosby|ovechkin)\b/i);
  });

  it("highlights nothing when the slot's character is unknown", () => {
    const html = renderToStaticMarkup(
      <CharacterSelect
        selectedCharacterId={null}
        headline="Pick for Bot 2"
        disabled={false}
        onChooseCharacter={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(html).not.toContain("Selected");
  });
});
