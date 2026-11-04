import { JsPsych, JsPsychPlugin, ParameterType, TrialType } from "jspsych";

import { version } from "../package.json";

const info = <const>{
  name: "plugin-saccades-selfpaced",
  version: version,
  parameters: {
    /** The size of the cues */
    cue_size: {
      type: ParameterType.STRING,
      default: "300px",
    },
    /** The margin around the cues */
    cue_margin: {
      type: ParameterType.STRING,
      default: "300px",
    },
    /** The duration of the trial (ms) */
    trial_duration: {
      type: ParameterType.INT,
      default: 5000,
    },
    /** Whether to give visual feedback after saccades */
    give_feedback: {
      type: ParameterType.BOOL,
      default: true,
    },
    /** The duration of the visual feedback */
    feedback_duration: {
      type: ParameterType.INT,
      default: 250,
    },
    /** Whether to enable debug mode */
    debug: {
      type: ParameterType.BOOL,
      default: false,
    },
  },
  data: {
    /** The reaction time of the saccade (in milliseconds) */
    rt: {
      type: ParameterType.INT,
    },
    correct: {
      type: ParameterType.BOOL,
    },
    /** The side where the cue appeared */
    cue_side: {
      type: ParameterType.STRING,
    },
    /** The side where the correct response should be */
    correct_side: {
      type: ParameterType.STRING,
    },
    /** The side where the participant looked */
    saccade_target: {
      type: ParameterType.STRING,
    },
  },
  // When you run build on your plugin, citations will be generated here based on the information in the CITATION.cff file.
  citations: "__CITATIONS__",
};

type Info = typeof info;

/**
 * **plugin-saccades-selfpaced**
 *
 * A plugin to implement self-paced saccades
 *
 * @author Victor Navarro
 * @see {@link https://github.com/jspsych/jspsych-contrib/packages/plugin-saccades-selfpaced/README.md}}
 */
class SaccadesSelfpacedPlugin implements JsPsychPlugin<Info> {
  static info = info;

  constructor(private jsPsych: JsPsych) {}

  async trial(display_element: HTMLElement, trial: TrialType<Info>) {
    // general purpose box
    const box = `height:${trial.cue_size}; width:${trial.cue_size}; visibility:hidden; display:flex; align-items:center; justify-content:center; box-sizing:border-box;`;
    const cue = `height:100%; width:100%; display:flex; align-items:center; justify-content:center; font-size:72px; visibility:hidden;`;
    var html = `<div class="saccades-array" style="display:flex; flex-direction:row; align-items:center; justify-content:center; gap:${trial.cue_margin}; height:100vh; width:100vw;">`;
    html += `<div id="left-cue-div" style="${box} background: lightgray;"><div id="left-cue" style="${cue}">X</div></div>`;
    html += `<div class="fixation" style="${box} font-size:64px;">+</div>`;
    html += `<div id="right-cue-div" style="${box} background: lightgray;"><div id="right-cue" style="${cue}">X</div></div>`;
    html += `</div>`;
    display_element.innerHTML = html;

    // saccadejs extension stuff
    const saccade = this.jsPsych.extensions.saccade;
    // Possible rectangles in the trial
    const rects = {
      left: display_element.querySelector("#left-cue-div").getBoundingClientRect(),
      right: display_element.querySelector("#right-cue-div").getBoundingClientRect(),
      fixation: display_element.querySelector(".fixation").getBoundingClientRect(),
    };

    // Helper function to determine if a point is within a rectangle
    const hit = (p, r) => p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;
    var looking: string = "";
    const stop = saccade.onGazeUpdate(({ x, y, t }) => {
      looking = Object.keys(rects).find((k) => hit({ x, y }, rects[k]));
      if (trial.debug) console.log(`Looking at: ${looking}`);
      return looking;
    });

    // RAF-based timing helper
    const waitForDuration = (duration: number): Promise<void> => {
      return new Promise((resolve) => {
        const startTime = performance.now();
        const checkTime = () => {
          if (performance.now() - startTime >= duration) {
            resolve();
          } else {
            requestAnimationFrame(checkTime);
          }
        };
        requestAnimationFrame(checkTime);
      });
    };

    const showFixation = () => {
      const fixation = display_element.querySelector(".fixation") as HTMLElement;
      if (fixation) fixation.style.visibility = "visible";
      const leftdiv = display_element.querySelector("#left-cue-div") as HTMLElement;
      if (leftdiv) leftdiv.style.visibility = "visible";
      const rightdiv = display_element.querySelector("#right-cue-div") as HTMLElement;
      if (rightdiv) rightdiv.style.visibility = "visible";
    };

    const captureFixation = (timeStart: number) =>
      new Promise<void>((resolve) => {
        let running = true;
        (async () => {
          while (running) {
            if (looking == "fixation") {
              if (trial.debug) console.log("Fixation acquired");
              running = false;
              resolve();
            }
            await waitForDuration(10); // Small delay to prevent busy-waiting
          }
        })();
      });

    var saccade_target: string | undefined = undefined;
    var saccade_rt: number | undefined = undefined;
    var saccade_accuracy: boolean | undefined = undefined;
    const captureSaccade = (valid_sides: string[], timeStart: number) =>
      new Promise<void>((resolve) => {
        let running = true;
        (async () => {
          while (running) {
            if (valid_sides.includes(looking)) {
              if (trial.debug) console.log(`Saccade to ${looking} acquired`);
              saccade_target = looking;
              saccade_rt = performance.now() - timeStart;
              saccade_accuracy = saccade_target === trial.correct_side;
              running = false;
              resolve();
            }
            console.log(performance.now() - timeStart);
            if (performance.now() - timeStart >= trial.timeout) {
              looking = "";
              running = false;
              resolve();
            }

            await waitForDuration(10); // Small delay to prevent busy-waiting
          }
        })();
      });

    const showTarget = async (side: string) => {
      if (trial.debug) console.log(`Showing target on side: ${side}`);
      const target = display_element.querySelector(`#${side}-cue`) as HTMLElement;
      if (target) target.style.visibility = "visible";
    };

    const showFeedback = (correct: boolean | undefined) => {
      if (correct === undefined) {
        var feedback_html = '<div class="feedback" style="font-size: 64px;">Miss!</div>';
      } else {
        var feedback_html = correct
          ? '<div class="feedback correct" style="font-size: 64px;">Correct</div>'
          : '<div class="feedback incorrect" style="color: red; font-size: 64px;">Incorrect</div>';
      }
      display_element.innerHTML = feedback_html;
    };
    await waitForDuration(trial.prefixation_time);
    showFixation();
    await waitForDuration(trial.fixation_min_duration);
    await captureFixation(performance.now());
    showTarget(trial.cue_side);
    await captureSaccade(["left", "right"], performance.now());
    if (trial.give_feedback) {
      showFeedback(saccade_accuracy);
    }
    await waitForDuration(trial.feedback_duration);

    stop(); // stop the gaze update listener

    // data saving
    var trial_data = {
      rt: saccade_rt,
      correct: saccade_target === trial.correct_side,
      cue_side: trial.cue_side,
      correct_side: trial.correct_side,
      saccade_target: saccade_target,
    };
    // end trial
    this.jsPsych.finishTrial(trial_data);
  }
}

export default SaccadesSelfpacedPlugin;
