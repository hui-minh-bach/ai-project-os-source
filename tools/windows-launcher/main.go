// AI Project OS Windows launcher (portable, no administrator privileges).
// Built with GOOS=windows GOARCH=amd64 CGO_ENABLED=0.
// It only executes scripts shipped next to the EXE and a SHA-256-verified
// official Node.js runtime; it never downloads arbitrary executable URLs.
package main

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

const version = "0.8.5"

func pause() {
	if stat, err := os.Stdin.Stat(); err == nil && stat.Mode()&os.ModeCharDevice != 0 {
		fmt.Print("Press Enter to close this window...")
		var s string
		fmt.Scanln(&s)
	}
}

func programRoot() (string, error) {
	executable, err := os.Executable()
	if err != nil {
		return "", err
	}
	root := filepath.Dir(executable)
	for _, file := range []string{"src\\launcher.mjs", "src\\server.mjs", "public\\index.html", "SETUP-RUNTIME-WINDOWS.ps1"} {
		if info, err := os.Stat(filepath.Join(root, file)); err != nil || info.IsDir() {
			return "", fmt.Errorf("Missing file %s. Extract the entire ZIP before launch", file)
		}
	}
	return root, nil
}
func acceptableNode(binary string) bool {
	cmd := exec.Command(binary, "-p", "process.versions.node.split('.')[0]")
	cmd.Env = os.Environ()
	raw, err := cmd.Output()
	if err != nil {
		return false
	}
	major, err := strconv.Atoi(strings.TrimSpace(string(raw)))
	return err == nil && major >= 22
}
func nodeBinary(root string) (string, error) {
	path := filepath.Join(root, "runtime-win-x64", "node.exe")
	if acceptableNode(path) {
		if _, err := os.Stat(filepath.Join(root, "runtime-win-x64", "node_modules", "npm", "bin", "npm-cli.js")); err == nil {
			return path, nil
		}
		// Existing runtime from an older release had only node.exe. Refresh it.
	}
	if acceptableNode("node.exe") {
		return "node.exe", nil
	}
	fmt.Println("Installing Node.js portable from the official source with SHA-256 verification...")
	ps := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", filepath.Join(root, "SETUP-RUNTIME-WINDOWS.ps1"))
	ps.Dir = root
	ps.Stdout = os.Stdout
	ps.Stderr = os.Stderr
	if err := ps.Run(); err != nil {
		return "", fmt.Errorf("Portable Node.js setup failed: %w. Check Internet or install Node.js 22+ from nodejs.org", err)
	}
	if !acceptableNode(path) {
		return "", fmt.Errorf("Node.js verification failed. No unverified runtime will be launched")
	}
	return path, nil
}
func diagnostics(root, node string) error {
	c := exec.Command(node, "tools\\doctor-cli.mjs")
	c.Dir = root
	c.Stdout = os.Stdout
	c.Stderr = os.Stderr
	if err := c.Run(); err != nil {
		return fmt.Errorf("Diagnostic failed: %w", err)
	}
	return nil
}
func main() {
	fmt.Printf("\nAI Project OS Local Worker %s (Windows portable)\n", version)
	fmt.Println("This window keeps the local service running. Close it after using the app.")
	root, err := programRoot()
	if err != nil {
		fmt.Println("ERROR:", err)
		pause()
		os.Exit(1)
	}
	node, err := nodeBinary(root)
	if err != nil {
		fmt.Println("ERROR:", err)
		pause()
		os.Exit(1)
	}
	if len(os.Args) > 1 {
		switch os.Args[1] {
		case "--version":
			fmt.Println(version)
			return
		case "--doctor":
			if err := diagnostics(root, node); err != nil {
				fmt.Println(err)
				pause()
				os.Exit(1)
			}
			pause()
			return
		default:
			fmt.Println("Usage: AI-Project-OS.exe [--version | --doctor]")
			pause()
			os.Exit(2)
		}
	}
	logfile := filepath.Join(os.Getenv("LOCALAPPDATA"), "AIProjectOSLocal", "logs")
	if os.Getenv("LOCALAPPDATA") == "" {
		logfile = filepath.Join(root, "logs")
	}
	// Keep only the latest startup log, avoid accumulating many huge files.
	_ = os.MkdirAll(logfile, 0700)
	f, openErr := os.OpenFile(filepath.Join(logfile, "launcher.log"), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0600)
	var output io.Writer = os.Stdout
	var errorOutput io.Writer = os.Stderr
	if openErr == nil {
		defer f.Close()
		if stat, err := f.Stat(); err == nil && stat.Size() > 2*1024*1024 {
			_ = f.Truncate(0)
			_, _ = f.Seek(0, 0)
		}
		output = io.MultiWriter(os.Stdout, f)
		errorOutput = io.MultiWriter(os.Stderr, f)
		fmt.Fprintf(f, "\n[%s] Starting %s from %s\n", time.Now().Format(time.RFC3339), version, root)
	}
	c := exec.Command(node, "src\\launcher.mjs")
	c.Env = append(os.Environ(), "AI_PROJECT_OS_NODE="+node)
	c.Dir = root
	c.Stdin = os.Stdin
	c.Stdout = output
	c.Stderr = errorOutput
	fmt.Println("Launching local application and browser...")
	if err := c.Run(); err != nil {
		fmt.Fprintln(errorOutput, "Local Worker stopped with error:", err)
		pause()
		os.Exit(1)
	}
}
