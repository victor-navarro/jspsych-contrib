import { JsPsych, JsPsychPlugin, ParameterType, TrialType } from "jspsych";

import { version } from "../package.json";

const info = <const>{
  name: "plugin-stop-signal-mm",
  version: version,
  parameters: {
    /**
    Go Stimulus modality. Either "visual" or "auditory"
    */
    go_modality: {
      type: ParameterType.STRING,
      default: "visual",
    },
    /**
    Stop Stimulus modality. Either "visual" or "auditory"
    */
    stop_modality: {
      type: ParameterType.STRING,
      default: "visual",
    },
    /**
    Go stimulus. Image path for visual stimulus (str) or frequency (int) for auditory stimulus.
    */
    go_stim: {
      type: ParameterType.COMPLEX,
      default: undefined,
    },
    /**
    Stop stimulus. Image path for visual stimulus (str) or frequency (int) for auditory stimulus.
    */
    stop_stim: {
      type: ParameterType.COMPLEX,
      default: undefined,
    },
    /**
    Stop signal delay in milliseconds. -1 indicates no stop signal will be presented.
    */
    stop_signal_delay: {
      type: ParameterType.INT,
      default: -1,
    },
    /**
    Trial duration in milliseconds.
    */
    trial_duration: {
      type: ParameterType.INT,
      default: 2000,
    },
    /**
    Choices for the participant's response.
    */
    choices: {
      type: ParameterType.STRING,
      default: undefined,
      array: true,
    },
    /**
    Correct choice for the trial.
    */
    correct_choice: {
      type: ParameterType.STRING,
      default: undefined,
    },
    /**
    Whether to show response buttons.
    */
    show_buttons: {
      type: ParameterType.BOOL,
      default: false,
    },
    /**
    Labels for the response buttons.
    */
    button_labels: {
      type: ParameterType.STRING,
      default: [],
      array: true,
    },
    /**
    Feedback strings for different trial outcomes.
    */
    feedback_strings: {
      type: ParameterType.COMPLEX,
      default: {
        correct: "Correct",
        incorrect: "Incorrect",
        nostop: "Remember to stop",
        miss: "Too slow",
      },
    },
    /**
    Feedback duration in milliseconds.
    */
    feedback_duration: {
      type: ParameterType.INT,
      default: 1000,
    },
    /**
    Height of the visual cue.
    */
    visual_height: {
      type: ParameterType.STRING,
      default: "20vw",
    },
    /**
    Width of the visual cue.
    */
    visual_width: {
      type: ParameterType.STRING,
      default: "20vw",
    },
    /**
    Post trial delay in milliseconds.
*/
    post_trial_delay: {
      type: ParameterType.INT,
      default: 1000,
    },
    /**
    Debug mode. If true, additional information will be logged to the console.
    */
    debug: {
      type: ParameterType.BOOL,
      default: false,
    },
  },
  data: {
    response: {
      type: ParameterType.STRING,
    },
    rt: {
      type: ParameterType.INT,
    },
    stop_signal_delay: {
      type: ParameterType.INT,
    },
    go_modality: {
      type: ParameterType.STRING,
    },
    stop_modality: {
      type: ParameterType.STRING,
    },
    go_stim: {
      type: ParameterType.COMPLEX,
    },
    stop_stim: {
      type: ParameterType.COMPLEX,
    },
  },
  // When you run build on your plugin, citations will be generated here based on the information in the CITATION.cff file.
  citations: "__CITATIONS__",
};

type Info = typeof info;

/**
 * **plugin-stop-signal-mm**
 *
 * Multimodal version of the stop signal task.
 *
 * @author Victor Navarro
 * @see {@link https://github.com/jspsych/jspsych-contrib/packages/plugin-stop-signal-mm/README.md}}
 */
class StopSignalMmPlugin implements JsPsychPlugin<Info> {
  static info = info;

  constructor(private jsPsych: JsPsych) {}

  async trial(display_element: HTMLElement, trial: TrialType<Info>) {
    // Parameter validation
    if (trial.trial_duration <= 0) {
      throw new Error("Trial duration must be greater than 0.");
    }
    if (!["visual", "auditory"].includes(trial.go_modality)) {
      throw new Error("Go modality must be either 'visual' or 'auditory'.");
    }
    if (!["visual", "auditory"].includes(trial.stop_modality)) {
      throw new Error("Stop modality must be either 'visual' or 'auditory'.");
    }
    if (trial.go_modality === "visual" && typeof trial.go_stim !== "string") {
      throw new Error("Go stimulus must be a string for visual modality.");
    }
    if (trial.go_modality === "auditory" && typeof trial.go_stim !== "number") {
      throw new Error("Go stimulus must be a number for auditory modality.");
    }
    if (trial.stop_modality === "visual" && typeof trial.stop_stim !== "string") {
      throw new Error("Stop stimulus must be a string for visual modality.");
    }
    if (trial.stop_modality === "auditory" && typeof trial.stop_stim !== "number") {
      throw new Error("Stop stimulus must be a number for auditory modality.");
    }

    // Create cue html
    var html = "";
    html += `<div id="cue-container" style="display: grid; place-items: center;">`;
    const vis_cue = `"grid-area: 1 / 1; width: ${trial.visual_width}; height: ${trial.visual_height};"`;
    if (trial.go_modality === "visual") {
      html += `<img id="go-container" src="${trial.go_stim}" style=${vis_cue}></img>`;
    }
    if (trial.stop_modality === "visual") {
      html += `<img id="stop-container" src="${trial.stop_stim}" style=${vis_cue};"></img>`;
    }
    // Create feedback html container
    html += `<div id="feedback-container" style="grid-area: 1 / 1; font-size: 24px;"></div>`;
    html += `</div>`; // Close cue-container

    // Create buttons html if necessary
    if (trial.show_buttons) {
      let labels = trial.button_labels.length > 0 ? trial.button_labels : trial.choices;
      html += `<div id="button-container" style="margin-top: 20px;">`;
      for (var i = 0; i < trial.choices.length; i++) {
        html += `<button id="button-${trial.choices[i]}" class="jspsych-btn" style="font-size: 48px;">${labels[i]}</button>`;
      }
      html += `</div>`;
    }

    display_element.innerHTML = html;

    // Audio
    const audioContext =
      trial.go_modality === "auditory" || trial.stop_modality === "auditory"
        ? new AudioContext()
        : null;
    // Plays an audio and returns the oscillator, so it can be stopped later if needed.
    const playAudio = (freq: number) => {
      const oscillator = audioContext!.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = freq;
      oscillator.connect(audioContext!.destination);
      oscillator.start();
      return oscillator;
    };

    const go_sound =
      trial.go_modality === "auditory" ? playAudio(trial.go_stim as number) : undefined;
    const stop_sound =
      trial.stop_modality === "auditory" ? playAudio(trial.stop_stim as number) : undefined;

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

    const goOn = () => {
      if (trial.debug) console.log("Go stimulus presented");
      if (trial.go_modality === "visual") {
        if (trial.stop_modality === "visual") {
          const stopContainer = document.getElementById("stop-container");
          if (stopContainer) {
            stopContainer.style.visibility = "hidden";
          }
        }
        const cueContainer = document.getElementById("go-container");
        if (cueContainer) {
          cueContainer.style.visibility = "visible";
        }
      } else if (trial.go_modality === "auditory") {
        // Play auditory go stimulus
        playAudio(trial.go_stim as number);
      }
    };

    const goOff = () => {
      if (trial.go_modality === "visual") {
        const cueContainer = document.getElementById("go-container");
        if (cueContainer) {
          cueContainer.style.visibility = "hidden";
        }
      } else {
        if (go_sound != undefined) {
          go_sound.stop();
        }
      }
    };

    const stopOn = () => {
      if (trial.debug) console.log("Stop stimulus presented");
      if (trial.stop_modality === "visual") {
        if (trial.go_modality === "visual") {
          const cueContainer = document.getElementById("go-container");
          if (cueContainer) {
            cueContainer.style.visibility = "hidden";
          }
        }
        const stopContainer = document.getElementById("stop-container");
        if (stopContainer) {
          stopContainer.style.visibility = "visible";
        }
      } else if (trial.stop_modality === "auditory") {
        // Play auditory stop stimulus
        playAudio(trial.stop_stim as number);
      }
    };

    const stopOff = () => {
      if (trial.stop_modality === "visual") {
        const stopContainer = document.getElementById("stop-container");
        if (stopContainer) {
          stopContainer.style.visibility = "hidden";
        }
      } else {
        if (stop_sound != undefined) {
          stop_sound.stop();
        }
      }
    };

    const registerListeners = (fn: (e: Event) => void) => {
      if (!trial.show_buttons) {
        document.addEventListener("keydown", fn);
      } else {
        for (var i = 0; i < trial.choices.length; i++) {
          const button = document.getElementById(`button-${trial.choices[i]}`);
          button?.addEventListener("pointerdown", fn);
        }
      }
    };

    const removeListeners = (fn: (e: Event) => void) => {
      document.removeEventListener("keydown", fn);
      const button = document.getElementById("tap-button");
      for (var i = 0; i < trial.choices.length; i++) {
        const button = document.getElementById(`button-${trial.choices[i]}`);
        button?.removeEventListener("pointerdown", fn);
      }
    };

    var response = "";
    var stop_response = false;
    var rt = -1;
    const handleResponse = (e: Event) => {
      if (e instanceof KeyboardEvent) {
        response = e.key;
        rt = performance.now() - start_time;
      } else if (e instanceof PointerEvent) {
        const target = e.target as HTMLElement;
        if (target && target.id.startsWith("button-")) {
          response = target.id.replace("button-", "");
          rt = performance.now() - start_time;
        }
      }
      stop_response = stop_shown;
      removeListeners(handleResponse);
    };

    var waiting = true;
    var stop_shown = false;
    const waitForResponse = async (
      start_time: number,
      trial_duration: number,
      stop_signal_delay: number
    ): Promise<void> => {
      registerListeners(handleResponse);
      try {
        // Start go signal
        goOn();
        // Just an FSM
        while (waiting) {
          if (response !== "" || performance.now() - start_time >= trial_duration) {
            waiting = false;
          }
          await new Promise(requestAnimationFrame);
          if (
            stop_signal_delay > 0 &&
            performance.now() - start_time >= stop_signal_delay &&
            !stop_shown
          ) {
            stopOn();
            stop_shown = true;
          }
        }
      } finally {
        // removes listeners in case no response
        removeListeners(handleResponse);
        goOff();
        stopOff();
      }
    };
    const showFeedback = () => {
      const feedbackContainer = document.getElementById("feedback-container");
      if (feedbackContainer) {
        let msg = "";
        if (response != "") {
          if (trial.stop_signal_delay < 0) {
            if (response === trial.correct_choice) {
              msg = trial.feedback_strings.correct || "Correct";
            } else {
              msg = trial.feedback_strings.incorrect || "Incorrect";
            }
          } else {
            if (stop_response) {
              msg = trial.feedback_strings.no_stop || "Remember to stop";
            }
          }
        } else {
          if (trial.stop_signal_delay < 0) {
            msg = trial.feedback_strings.miss || "Too slow";
          }
        }
        feedbackContainer.innerHTML = msg;
        feedbackContainer.style.visibility = "visible";
      }
    };

    const hideFeedback = () => {
      const feedbackContainer = document.getElementById("feedback-container");
      if (feedbackContainer) {
        feedbackContainer.style.visibility = "hidden";
      }
    };

    const start_time = performance.now();
    await waitForResponse(start_time, trial.trial_duration, trial.stop_signal_delay);
    // Show feedback
    if (trial.feedback_duration > 0) {
      showFeedback();
      await waitForDuration(trial.feedback_duration);
      hideFeedback();
    }
    await waitForDuration(trial.post_trial_delay);

    // data saving
    var trial_data = {
      response: response,
      rt: rt,
      stop_signal_delay: trial.stop_signal_delay,
      go_modality: trial.go_modality,
      stop_modality: trial.stop_modality,
      go_stim: trial.go_stim,
      stop_stim: trial.stop_stim,
      correct_choice: trial.correct_choice,
    };
    // end trial
    this.jsPsych.finishTrial(trial_data);
  }
}

export default StopSignalMmPlugin;
