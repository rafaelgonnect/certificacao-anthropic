import { describe, it, expect } from "vitest";
import { validatePack, type CertificationPack } from "../prisma/content/pack.js";

function validPack(): CertificationPack {
  return {
    slug: "test-cert",
    title: "Test Certification",
    description: "A pack used only in unit tests.",
    version: 1,
    modules: [
      {
        title: "Module One",
        lessons: [
          {
            title: "Lesson One",
            readingMd: "# Lesson One\n\nSome reading content.",
            flashcards: [{ front: "Q?", back: "A.", tags: ["api"] }],
            questions: [
              {
                prompt: "What is 2 + 2?",
                options: ["3", "4", "5"],
                correctIndex: 1,
                explanation: "2 + 2 = 4.",
                difficulty: 1,
                tags: ["api"],
              },
            ],
            labs: [
              {
                title: "A lab",
                promptMd: "Do the thing.",
                rubric: ["Did the thing"],
                modelAnswer: "Here is the thing.",
              },
            ],
          },
        ],
      },
    ],
  };
}

describe("validatePack", () => {
  it("returns the pack unchanged when valid", () => {
    const pack = validPack();
    expect(validatePack(pack)).toBe(pack);
  });

  it("throws when a question correctIndex is out of range, mentioning the offending question", () => {
    const pack = validPack();
    pack.modules[0].lessons[0].questions![0].correctIndex = 9;
    pack.modules[0].lessons[0].questions![0].prompt = "What is 2 + 2?";
    let err: Error | undefined;
    try {
      validatePack(pack);
    } catch (e) {
      err = e as Error;
    }
    expect(err).toBeInstanceOf(Error);
    expect(err!.message).toMatch(/correctIndex 9 is out of range/);
    expect(err!.message).toContain("What is 2 + 2?");
  });

  it("throws when a module has no lessons, naming the module", () => {
    const pack = validPack();
    pack.modules[0].lessons = [];
    expect(() => validatePack(pack)).toThrow(/module\[0\] "Module One": must have at least 1 lesson/);
  });

  it("throws when there are no modules", () => {
    const pack = validPack();
    pack.modules = [];
    expect(() => validatePack(pack)).toThrow(/at least 1 module/);
  });

  it("throws when a question has fewer than 2 options", () => {
    const pack = validPack();
    pack.modules[0].lessons[0].questions![0].options = ["only one"];
    pack.modules[0].lessons[0].questions![0].correctIndex = 0;
    expect(() => validatePack(pack)).toThrow(/must have at least 2 options/);
  });

  it("throws when tags are empty", () => {
    const pack = validPack();
    pack.modules[0].lessons[0].flashcards![0].tags = [];
    expect(() => validatePack(pack)).toThrow(/tags must be a non-empty array/);
  });

  it("collects multiple problems into one message", () => {
    const pack = validPack();
    pack.slug = "";
    pack.modules[0].lessons[0].questions![0].correctIndex = 99;
    let err: Error | undefined;
    try {
      validatePack(pack);
    } catch (e) {
      err = e as Error;
    }
    expect(err).toBeInstanceOf(Error);
    expect(err!.message).toMatch(/slug must be a non-empty string/);
    expect(err!.message).toMatch(/out of range/);
    expect(err!.message).toMatch(/2 problem\(s\)/);
  });
});
