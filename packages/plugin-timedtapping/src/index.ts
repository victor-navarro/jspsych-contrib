import { JsPsych, JsPsychPlugin, ParameterType, TrialType } from "jspsych";

import { version } from "../package.json";

const info = <const>{
  name: "plugin-timedtapping",
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
      default: 4000,
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
    Response mode ("keyboard" or "button"). If keyboard, responses are collected via spacebar; if button, responses are collected via an on-screen button.
    */
    response_mode: {
      type: ParameterType.STRING,
      default: "keyboard",
    },
    /**
    Prompt to display during cued part of the trial.
    */
    cued_prompt: {
      type: ParameterType.STRING,
      default: "Respond in sync with the cue",
    },
    /**
    Prompt to display during uncued part of the trial.
    */
    uncued_prompt: {
      type: ParameterType.STRING,
      default: "Keep responding!",
    },
    /**
    Whether to wait for tapping synchronization during cued portion of the trial before proceeding to the uncued portion.
    */
    wait_for_sync: {
      type: ParameterType.BOOL,
      default: true,
    },
    /**
    Syncing tolerance (in milliseconds) for determining if the participant is in sync with the cue. Only used if wait_for_sync is true.
    */
    sync_tolerance: {
      type: ParameterType.INT,
      default: 150,
    },
    /**
    Number of taps required for syncing with the cue. Only used if wait_for_sync is true.
    */
    num_taps_for_sync: {
      type: ParameterType.INT,
      default: 3,
    },
    /**
     Whether to show a progress indicator during the uncued portion of the trial.
    */
    show_progress: {
      type: ParameterType.BOOL,
      default: true,
    },
    /**
    Interval (in milliseconds) at which the progress indicator is updated during the uncued portion of the trial. No effect if show_progress is false.
    */
    progress_interval: {
      type: ParameterType.INT,
      default: 2000,
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
    /** Array of cue onset times (in milliseconds) during the trial. Separately for cued and uncued portions of the trial.*/
    cue_onsets: {
      type: ParameterType.COMPLEX,
    },
    /** Array of tap onset times (in milliseconds) during the trial. Separately for cued and uncued portions of the trial. */
    tap_onsets: {
      type: ParameterType.COMPLEX,
    },
    /** Array of tap asynchronies to the closest cue(in milliseconds) during the trial. Separately for cued and uncued portions of the trial. */
    tap_asyncs: {
      type: ParameterType.COMPLEX,
    },
  },
  // When you run build on your plugin, citations will be generated here based on the information in the CITATION.cff file.
  citations: "__CITATIONS__",
};

type Info = typeof info;

/**
 * **plugin-timedtapping**
 *
 * Plugin to administer a timed tapping test on PC or mobile devices.
 *
 * @author Victor Navarro
 * @see {@link https://github.com/jspsych/jspsych-contrib/packages/plugin-timedtapping/README.md}}
 */
class TimedtappingPlugin implements JsPsychPlugin<Info> {
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
    if (trial.intercue_interval - trial.cue_duration <= 0) {
      throw new Error("intercue_interval must be greater than cue_duration");
    }
    if (!["visual", "auditory"].includes(trial.cue_modality)) {
      throw new Error("cue_modality must be either 'visual' or 'auditory'");
    }
    if (!["keyboard", "button"].includes(trial.response_mode)) {
      throw new Error("response_mode must be either 'keyboard' or 'button'");
    }

    // Create cue html
    var html = "";
    html += trial.visual_cue_html;

    // Create prompt container
    html += `<div id="prompt-container" style="margin-top: 80px;">${trial.cued_prompt}</div>`;

    // Create button html if necessary
    if (trial.response_mode === "button") {
      html += `<div id="button-container" style="margin-top: 0px;">`;
      html += '<button id="tap-button" class="jspsych-btn" style="font-size: 48px;">Tap</button>';
      html += `</div>`;
    }

    html += `<div id="progress-container" style="visibility: hidden; margin-top: 24px;"> <progress id="uncued-progress" max="1" value="0" style="width: 300px;"></progress></div>`;

    display_element.innerHTML = html;

    // Audio
    const audioContext = trial.cue_modality === "auditory" ? new AudioContext() : null;

    const playTick = () => {
      if (!audioContext) return;

      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const now = audioContext.currentTime;

      oscillator.type = "sine";
      oscillator.frequency.value = 1000; // Hz

      // Brief attack followed by a rapid decay.
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);

      oscillator.connect(gain);
      gain.connect(audioContext.destination);

      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };

      oscillator.start(now);
      oscillator.stop(now + 0.035);
    };

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

    const cueON = () => {
      if (trial.cue_modality === "auditory") {
        playTick();
      } else {
        const targetElem = document.getElementById("cue");
        if (targetElem) targetElem.style.visibility = "visible";
      }
    };
    const cueOFF = () => {
      if (trial.cue_modality == "visual") {
        const targetElem = document.getElementById("cue");
        if (targetElem) targetElem.style.visibility = "hidden";
      }
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

    const cueOnsets: { cued: number[]; uncued: number[] } = { cued: [], uncued: [] };
    const tapOnsets: { cued: number[]; uncued: number[] } = { cued: [], uncued: [] };
    const tapAsyncs: { cued: number[]; uncued: number[] } = { cued: [], uncued: [] };

    // Define a tap synchronization routine
    const tapWindow: number[] = [];
    const syncTaps = (startTime: number) =>
      new Promise<void>((resolve) => {
        let running = true;
        let nextCue: number = -1;
        let pastCue: number = -1;

        const onTap = (e: Event) => {
          if (nextCue < 0 || pastCue < 0) return;
          if (trial.response_mode === "keyboard" && (e as KeyboardEvent).key !== " ") return;
          const t = e.timeStamp;
          const k1 = t - pastCue; // time since last cue
          const k2 = nextCue - t; // time until next cue
          const asyn = Math.round(Math.min(Math.abs(k1), Math.abs(k2))); // asynchrony relative to nearest cue
          const taponset = Math.round(t - startTime);
          if (taponset > 0) {
            tapWindow.push(asyn);
            tapAsyncs.cued.push(asyn);
            tapOnsets.cued.push(taponset);
          }
          // shift window if it exceeds the maximum size N
          if (tapWindow.length > trial.num_taps_for_sync) tapWindow.shift();
          if (trial.debug) console.log(`Tap asynchrony: ${asyn} (curr windows: ${tapWindow})`);
          // check if done
          if (
            tapWindow.length === trial.num_taps_for_sync &&
            tapWindow.every((a) => Math.abs(a) <= trial.sync_tolerance)
          ) {
            running = false;
            removeListeners(onTap);
            resolve();
          }
        };
        registerListeners(onTap);

        (async () => {
          while (running) {
            pastCue = performance.now();
            nextCue = pastCue + trial.intercue_interval;
            cueOnsets.cued.push(Math.round(pastCue - startTime));
            cueON();
            await waitForDuration(trial.cue_duration);
            cueOFF();
            await waitForDuration(trial.intercue_interval - trial.cue_duration);
          }
        })();
      });

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
      // hide cue container
      const cue_container = document.getElementById("cue-container");
      if (cue_container) {
        cue_container.style.visibility = "hidden";
      }
      // hide the progress bar container
      const progress_container = document.getElementById("progress-container");
      if (progress_container) {
        progress_container.style.visibility = "hidden";
      }
      // remove the audio context if it exists
      if (audioContext != null) audioContext.close();
    };

    // Define the routine to (optionally blink) the cue
    // and collect responses
    const collectResponses = async (
      startTime: number,
      showCue: boolean,
      duration: number
    ): Promise<void> => {
      let nextCue: number = -1;
      let pastCue: number = -1;
      // deal with prompt
      const prompt_container = document.getElementById("prompt-container");
      const progress_bar = document.getElementById("uncued-progress") as HTMLProgressElement | null;
      const progress_container = document.getElementById("progress-container");
      let progress_timer: number | undefined;
      // define tap handler for collecting responses
      const onTap = (e: Event) => {
        if (nextCue < 0 || pastCue < 0) return;
        if (trial.response_mode === "keyboard" && (e as KeyboardEvent).key !== " ") return;
        const t = e.timeStamp;
        const k1 = t - pastCue; // time since last cue
        const k2 = nextCue - t; // time until next cue
        const asyn = Math.round(Math.min(Math.abs(k1), Math.abs(k2))); //asynchrony relative to nearest cue
        const taponset = Math.round(t - startTime);
        if (taponset > 0) {
          if (showCue) {
            tapAsyncs.cued.push(asyn);
            tapOnsets.cued.push(taponset);
          } else {
            tapAsyncs.uncued.push(asyn);
            tapOnsets.uncued.push(taponset);
          }
        }
        if (trial.debug) console.log(`Tap asynchrony: ${asyn}`);
      };

      try {
        // deal with prompt
        if (prompt_container) {
          prompt_container.innerHTML = showCue ? trial.cued_prompt : trial.uncued_prompt;
        }
        // deal with progress bar
        if (!showCue && trial.show_progress && progress_bar) {
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
        while (startTime + duration > performance.now()) {
          pastCue = performance.now();
          nextCue = pastCue + trial.intercue_interval;

          if (showCue) {
            cueOnsets.cued.push(Math.round(pastCue - startTime));
            cueON();
          } else {
            cueOnsets.uncued.push(Math.round(pastCue - startTime));
          }
          await waitForDuration(trial.cue_duration);
          cueOFF();
          await waitForDuration(trial.intercue_interval - trial.cue_duration);
        }
      } finally {
        removeListeners(onTap);
        if (!showCue) {
          if (progress_bar) progress_bar.value = 1;
          if (progress_container) progress_container.style.visibility = "hidden";
          if (progress_timer != undefined) window.clearInterval(progress_timer);
        }
      }
    };

    // hide cue
    const cueElem = document.getElementById("cue");
    if (cueElem) cueElem.style.visibility = "hidden";

    // Cued portion
    if (trial.debug) console.log("Starting cued portion...");
    if (trial.wait_for_sync) {
      if (trial.debug) console.log("Waiting for sync...");
      await syncTaps(performance.now());
    } else {
      await collectResponses(performance.now(), true, trial.cued_duration);
    }

    if (trial.debug) console.log("Starting uncued portion...");
    // uncued portion
    await collectResponses(performance.now(), false, trial.uncued_duration);

    cleanup();

    // Process data
    var trial_data = {
      cue_onsets: cueOnsets,
      tap_onsets: tapOnsets,
      tap_asyncs: tapAsyncs,
    };
    // end trial
    this.jsPsych.finishTrial(trial_data);
  }
}

export default TimedtappingPlugin;
