# AgentBridge

[WIP] This project is under active development.

AgentBridge is a standalone open-source utility to securely install, manage, and debug Chrome Native Messaging hosts.
The Problem

The Native Messaging API is incredibly powerful, but it's difficult to set up. It requires:

    Creating a JSON "manifest" file.

    Placing it in a platform-specific, hidden directory.

    On Windows, creating and managing specific Registry keys.

    Figuring out permissions and script execution paths.

    Difficult debugging when (not if) it goes wrong.

The Solution

AgentBridge is an Electron-based desktop app that provides a simple GUI to manage this entire process.

    No more manual manifests: Point to your script (e.g., script.py), give it a name, and AgentBridge handles the rest.

    No more Registry editing: AgentBridge manages the Windows Registry keys for you.

    Platform-agnostic: Works the same on Windows, macOS, and Linux.

    Secure: Manages a secure proxy host, ensuring Chrome can only talk to the scripts you've explicitly allowed.

Roadmap

    [x] Core logic for installing/uninstalling hosts on Windows, macOS, and Linux.

    [ ] Bundled generic proxy host script.

    [ ] MVP UI for adding/removing hosts.

    [ ] electron-builder configuration for distributables.

    [ ] 5-Minute "Hello World" example project.

    [ ] Built-in stderr log viewer for easier debugging.

    [ ] Support for Firefox.
