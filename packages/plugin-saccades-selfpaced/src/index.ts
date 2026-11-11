import { JsPsych, JsPsychPlugin, ParameterType, TrialType } from "jspsych";

import { version } from "../package.json";

const info = <const>{
  name: "plugin-saccades-selfpaced",
  version: version,
  parameters: {
    /** The duration of the trial (ms) */
    trial_duration: {
      type: ParameterType.INT,
      default: 5000,
    },
    /**
    Countdown before the trial starts (in milliseconds).
    */
    countdown_duration: {
      type: ParameterType.INT,
      default: 4000,
    },
    /**
    Post-trial delay (in milliseconds).
    */
    post_trial_delay: {
      type: ParameterType.INT,
      default: 0,
    },
    /** The height of the cues */
    cue_height: {
      type: ParameterType.STRING,
      default: "10vw",
    },
    /** The width of the cues */
    cue_width: {
      type: ParameterType.STRING,
      default: "10vw",
    },
    /** The margin around the cues */
    cue_margin: {
      type: ParameterType.STRING,
      default: "20vw",
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
    /** The targets of the saccades */
    saccade_targets: {
      type: ParameterType.STRING,
      array: true,
    },
    /** The timings of the saccades */
    saccade_timings: {
      type: ParameterType.INT,
      array: true,
    },
    /** The number of saccades */
    saccade_count: {
      type: ParameterType.INT,
    },
    /** The rate of saccades (saccades per millisecond) */
    saccade_rate: {
      type: ParameterType.FLOAT,
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
    const box = `height:${trial.cue_height}; width:${trial.cue_width}; visibility:hidden; display:flex; align-items:center; justify-content:center; box-sizing:border-box;`;
    const cue = `height:100%; width:100%; display:flex; align-items:center; justify-content:center; font-size:72px; visibility:hidden;`;
    // Create prompt container
    var html = `<div class="saccades-array" style="display:flex; flex-direction:row; align-items:center; justify-content:center; gap:${trial.cue_margin}; height:90vh; width:90vw;">`;
    html += `<div id="left-cue-div" style="${box} background: lightgray;"><div id="left-cue" style="${cue}">X</div></div>`;
    html += `<div id="prompt-container" style="position:absolute; left:50%; top:50%; transform:translate(-50%, -50%);visibility:hidden; font-size:64px;">+</div>`;
    html += `<div id="right-cue-div" style="${box} background: lightgray;"><div id="right-cue" style="${cue}">X</div></div>`;
    html += `</div>`;
    display_element.innerHTML = html;

    // saccadejs extension stuff
    const saccade = this.jsPsych.extensions.saccade;
    if (!saccade) {
      throw new Error(
        "Saccade extension not found. Make sure you include the saccadejs extension."
      );
    }
    // Possible rectangles in the trial
    const rects = {
      left: display_element.querySelector("#left-cue-div").getBoundingClientRect(),
      right: display_element.querySelector("#right-cue-div").getBoundingClientRect(),
    };
    const valid_targets = ["left", "right"];

    // Helper function to determine if a point is within a rectangle
    const hit = (p, r) => p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;

    var trial_started = false;
    var looking: string | undefined = undefined;
    var saccade_targets: string[] = [];
    var saccade_timings: number[] = [];
    let last_target: string | undefined = undefined;

    const showFeedback = async (side: string) => {
      const cue = display_element.querySelector(`#${side}-cue`) as HTMLElement;
      if (cue) {
        cue.style.visibility = "visible";
        await waitForDuration(trial.feedback_duration);
        cue.style.visibility = "hidden";
      }
    };

    const hidePrompt = () => {
      const prompt = display_element.querySelector("#prompt-container") as HTMLElement;
      if (prompt) prompt.style.visibility = "hidden";
    };

    const stop = saccade.onGazeUpdate(async ({ x, y, t }) => {
      if (trial_started) {
        var looking = Object.keys(rects).find((k) => hit({ x, y }, rects[k]));
        if (trial.debug) console.log(`Looking at: ${looking}`);
        if (valid_targets.includes(looking) && looking !== last_target) {
          last_target = looking;
          saccade_targets.push(looking);
          saccade_timings.push(t);
          if (trial.debug) console.log(`Saccade recorded: ${looking} at ${t}`);
          if (trial.give_feedback) {
            await showFeedback(looking);
          }
        }
      }
    });

    // RAF-based timing helper
    const waitForDuration = (duration: number): Promise<void> => {
      return new Promise((resolve) => {
        const start_time = performance.now();
        const checkTime = () => {
          if (performance.now() - start_time >= duration) {
            resolve();
          } else {
            requestAnimationFrame(checkTime);
          }
        };
        requestAnimationFrame(checkTime);
      });
    };

    // Shows the cue divs
    const showCueDivs = () => {
      const leftdiv = display_element.querySelector("#left-cue-div") as HTMLElement;
      if (leftdiv) leftdiv.style.visibility = "visible";
      const rightdiv = display_element.querySelector("#right-cue-div") as HTMLElement;
      if (rightdiv) rightdiv.style.visibility = "visible";
    };

    // Define countdown routine
    // It just changes the prompt text from 3 down to 1 before the trial starts
    const countdown = async (start_time: number): Promise<void> => {
      const stepDuration = trial.countdown_duration / 4; // 4 implies Go!
      const prompt_container = document.getElementById("prompt-container");
      prompt_container.style.visibility = "visible";
      prompt_container.style.fontSize = "2em";
      if (!prompt_container) return;
      for (let i = 3; i > 0; i--) {
        prompt_container.textContent = i.toString();
        await waitForDuration(stepDuration);
      }
    };

    // Start trials
    if (trial.debug) console.log("Starting trial...");
    await countdown(performance.now());
    hidePrompt();
    if (trial.debug) console.log("Countdown finished");
    showCueDivs();
    trial_started = true;
    await waitForDuration(trial.trial_duration);
    stop(); // remove saccade listener
    await waitForDuration(trial.post_trial_delay);

    // data saving
    var trial_data = {
      saccade_targets: saccade_targets,
      saccade_timings: saccade_timings,
      saccade_count: saccade_targets.length,
      saccade_rate: saccade_targets.length / (trial.trial_duration / 1000),
    };
    // end trial
    this.jsPsych.finishTrial(trial_data);
  }
}

export default SaccadesSelfpacedPlugin;
