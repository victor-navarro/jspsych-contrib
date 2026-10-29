import { JsPsych, JsPsychPlugin, ParameterType, TrialType } from "jspsych";

import { version } from "../package.json";

const info = <const>{
  name: "plugin-speededtapping",
  version: version,
  parameters: {
    /** Duration of the of the trial (in milliseconds). */
    trial_duration: {
      type: ParameterType.INT,
      default: 4000,
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
      default: 1000,
    },
    /**
    Response mode ("keyboard" or "button"). If keyboard, responses are collected via spacebar; if button, responses are collected via an on-screen button.
    */
    response_mode: {
      type: ParameterType.STRING,
      default: "keyboard",
    },
    /**
    Prompt to display during the trial.
    */
    trial_prompt: {
      type: ParameterType.STRING,
      default: "Keep tapping!",
    },
    /**
     Whether to show a progress indicator during the trial.
    */
    show_progress: {
      type: ParameterType.BOOL,
      default: true,
    },
    /**
    Interval (in milliseconds) at which the progress indicator is updated. No effect if show_progress is false.
    */
    progress_interval: {
      type: ParameterType.INT,
      default: 1000,
    },
    /**
    Whether to print debug information to the console during the trial.
     */
    debug: {
      type: ParameterType.BOOL,
      default: false,
    },
  },
  data: {
    /** Array of tap onset times (in milliseconds) during the trial. */
    tap_onsets: {
      type: ParameterType.COMPLEX,
    },
    /** Average tap frequency (in Hz) during the trial. */
    tap_frequency: {
      type: ParameterType.FLOAT,
    },
  },
  // When you run build on your plugin, citations will be generated here based on the information in the CITATION.cff file.
  citations: "__CITATIONS__",
};

type Info = typeof info;

/**
 * **plugin-speededtapping**
 *
 * Plugin to administer a timed tapping test on PC or mobile devices.
 *
 * @author Victor Navarro
 * @see {@link https://github.com/jspsych/jspsych-contrib/packages/plugin-speededtapping/README.md}}
 */
class SpeededTappingPlugin implements JsPsychPlugin<Info> {
  static info = info;

  constructor(private jsPsych: JsPsych) {}

  async trial(display_element: HTMLElement, trial: TrialType<Info>) {
    // Validate parameters
    if (trial.trial_duration <= 0) {
      throw new Error("trial_duration must be greater than 0");
    }
    if (!["keyboard", "button"].includes(trial.response_mode)) {
      throw new Error("response_mode must be either 'keyboard' or 'button'");
    }

    var html = "";
    // Create prompt container
    html += `<div id="prompt-container" style="margin-top: 80px;">${trial.trial_prompt}</div>`;

    // Create button html if necessary
    if (trial.response_mode === "button") {
      html += `<div id="button-container" style="margin-top: 0px;">`;
      html +=
        '<button id="tap-button" class="jspsych-btn" style="font-size: 48px;" disabled="true">Tap</button>';
      html += `</div>`;
    }

    html += `<div id="progress-container" style="visibility: hidden; margin-top: 24px;"> <progress id="progress-bar" max="1" value="0" style="width: 300px;"></progress></div>`;

    display_element.innerHTML = html;

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

    const registerListeners = (fn: (e: Event) => void) => {
      if (trial.response_mode == "keyboard") {
        document.addEventListener("keydown", fn);
      }
      if (trial.response_mode == "button") {
        const button = document.getElementById("tap-button");
        button?.addEventListener("pointerdown", fn);
      }
    };
    const removeListeners = (fn: (e: Event) => void) => {
      document.removeEventListener("keydown", fn);
      const button = document.getElementById("tap-button");
      button?.removeEventListener("pointerdown", fn);
    };

    const tapOnsets: number[] = [];

    // Utility for removing items
    const cleanup = () => {
      // hide prompt
      const prompt_container = document.getElementById("prompt-container");
      if (prompt_container) {
        prompt_container.style.visibility = "hidden";
      }
      // hide button container
      const button_container = document.getElementById("button-container");
      if (button_container) {
        button_container.style.visibility = "hidden";
      }
      // hide the progress bar container
      const progress_container = document.getElementById("progress-container");
      if (progress_container) {
        progress_container.style.visibility = "hidden";
      }
    };

    // Define countdown routine
    // It just changes the prompt text from 3 down to 1 before the trial starts
    const countdown = async (startTime: number): Promise<void> => {
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

    // Define the routine to collect responses
    const collectResponses = async (startTime: number, duration: number): Promise<void> => {
      // deal with prompt
      const prompt_container = document.getElementById("prompt-container");
      prompt_container.style.visibility = "visible";
      prompt_container.innerHTML = trial.trial_prompt;
      const progress_bar = document.getElementById("progress-bar") as HTMLProgressElement | null;
      const progress_container = document.getElementById("progress-container");
      // enable button if response mode is button
      const tap_button = document.getElementById("tap-button") as HTMLButtonElement | null;
      if (tap_button && trial.response_mode === "button") {
        tap_button.disabled = false;
      }
      let progress_timer: number | undefined;
      // define tap handler for collecting responses
      const onTap = (e: Event) => {
        if (
          trial.response_mode === "keyboard" &&
          ((e as KeyboardEvent).key !== " " || (e as KeyboardEvent).repeat)
        )
          return;
        const taponset = Math.round(e.timeStamp - startTime);
        if (taponset > 0) {
          tapOnsets.push(taponset);
        }
        if (trial.debug) console.log(`Tap at: ${taponset}`);
      };

      try {
        // deal with progress bar
        if (trial.show_progress && progress_bar) {
          progress_bar.value = 0;
          if (progress_container) {
            if (trial.debug) console.log("Showing progress container");
            progress_container.style.visibility = "visible";
          }
          const updateProgress = () => {
            progress_bar.value = Math.min((performance.now() - startTime) / duration, 1);
          };
          updateProgress();
          progress_timer = window.setInterval(updateProgress, trial.progress_interval);
        }
        registerListeners(onTap);
        // this shouldn't spam given the await calls below
        await waitForDuration(trial.trial_duration);
      } finally {
        removeListeners(onTap);
        if (progress_bar) progress_bar.value = 1;
        if (progress_container) progress_container.style.visibility = "hidden";
        if (progress_timer != undefined) window.clearInterval(progress_timer);
      }
    };
    // Start trial
    await countdown(performance.now());
    if (trial.debug) console.log("Starting trial...");
    await collectResponses(performance.now(), trial.trial_duration);

    cleanup();

    // Post-trial delay
    if (trial.post_trial_delay) {
      await waitForDuration(trial.post_trial_delay);
    }

    // Process data
    var trial_data = {
      tap_onsets: tapOnsets,
      tap_frequency: tapOnsets.length / (trial.trial_duration / 1000),
    };
    // end trial
    this.jsPsych.finishTrial(trial_data);
  }
}

export default SpeededTappingPlugin;
