import { JsPsych, JsPsychPlugin, ParameterType, TrialType } from "jspsych";

import { version } from "../package.json";

const info = <const>{
  name: "plugin-fingertapping",
  version: version,
  parameters: {
    /** Duration of the cued portion of the trial (in milliseconds). */
    cued_duration: {
      type: ParameterType.INT,
      default: 2000,
    },
    /** Duration of the uncued portion of the trial (in milliseconds). */
    uncued_duration: {
      type: ParameterType.INT,
      default: 2000,
    },
    /** 
    Intercue interval (in milliseconds).
    */
    intercue_interval: {
      type: ParameterType.INT,
      default: 1000,
    },
    /**
     Cue modality (e.g., "visual", "auditory")
     */
    cue_modality: {
      type: ParameterType.STRING,
      default: "visual",
    },
    /**
    Cue duration(in milliseconds)
    */
    cue_duration: {
      type: ParameterType.INT,
      default: 250,
    },
    /**
    Visual cue HTML content
    */
    visual_cue_html: {
      type: ParameterType.HTML_STRING,
      default: `<div id="cue" style="font-size:64pt;">+</div>`,
    },
    /**
    Show tap button
    */
    show_tap_button: {
      type: ParameterType.BOOL,
      default: true,
    },
  },
  data: {
    /** Provide a clear description of the data1 that could be used as documentation. We will eventually use these comments to automatically build documentation and produce metadata. */
    data1: {
      type: ParameterType.INT,
    },
    /** Provide a clear description of the data2 that could be used as documentation. We will eventually use these comments to automatically build documentation and produce metadata. */
    data2: {
      type: ParameterType.STRING,
    },
  },
  // When you run build on your plugin, citations will be generated here based on the information in the CITATION.cff file.
  citations: "__CITATIONS__",
};

type Info = typeof info;

/**
 * **plugin-fingertapping**
 *
 * Plugin to administer a fingertapping test on PC or mobile devices.
 *
 * @author Victor Navarro
 * @see {@link https://github.com/jspsych/jspsych-contrib/packages/plugin-fingertapping/README.md}}
 */
class FingertappingPlugin implements JsPsychPlugin<Info> {
  static info = info;

  constructor(private jsPsych: JsPsych) {}

  async trial(display_element: HTMLElement, trial: TrialType<Info>) {
    // Validate parameters
    if (trial.cued_duration <= 0) {
      throw new Error("cued_duration must be greater than 0");
    }
    if (trial.uncued_duration <= 0) {
      throw new Error("uncued_duration must be greater than 0");
    }
    if (trial.intercue_interval <= 0) {
      throw new Error("intercue_interval must be greater than 0");
    }
    if (trial.cue_duration <= 0) {
      throw new Error("cue_duration must be greater than 0");
    }
    // Create cue html
    var cue_html = "";
    if (trial.cue_modality === "visual") {
      cue_html = trial.visual_cue_html;
    } else if (trial.cue_modality === "auditory") {
      throw new Error("Auditory cue modality is not yet implemented");
    }
    display_element.innerHTML = cue_html;

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

    const presentCue = () => {
      const targetElem = document.getElementById("cue");
      if (targetElem) targetElem.style.visibility = "visible";
    };
    const hideCue = () => {
      const targetElem = document.getElementById("cue");
      if (targetElem) targetElem.style.visibility = "hidden";
    };

    // Cued portion
    const trialStartTime = performance.now();
    while (performance.now() - trialStartTime < trial.cued_duration) {
      presentCue();
      await waitForDuration(trial.cue_duration);
      hideCue();
      await waitForDuration(trial.intercue_interval - trial.cue_duration);
    }

    // Uncued portion
    const uncuedStartTime = performance.now();
    while (performance.now() - uncuedStartTime < trial.uncued_duration) {
      await waitForDuration(trial.intercue_interval);
    }

    // data saving
    var trial_data = {
      data1: 99, // Make sure this type and name matches the information for data1 in the data object contained within the info const.
      data2: "hello world!", // Make sure this type and name matches the information for data2 in the data object contained within the info const.
    };
    // end trial
    this.jsPsych.finishTrial(trial_data);
  }
}

export default FingertappingPlugin;
