import { startTimeline } from "@jspsych/test-utils";

import jsPsychFingertapping from ".";

jest.useFakeTimers();

describe("my plugin", () => {
  it("should load", async () => {
    const { expectFinished, getHTML, getData, displayElement, jsPsych } = await startTimeline([
      {
        type: jsPsychFingertapping,
        parameter_name: 1,
        parameter_name2: "img.png",
      },
    ]);

    await expectFinished();
  });
});
