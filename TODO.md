# TODO - ComputerAssemblyChallenge Build State Modification

## Task
Modify the build state behavior so that:
- Build state only updates up to state 4 (reserved for motherboard/GPU completion)
- SSD, case-fan, and PSU should NOT affect or change the main build state

## Steps

- [x] Analyze the current code behavior in ComputerAssemblyChallenge.tsx
- [x] Modify COMPONENT_TO_STATE_MAP to map SSD, case-fan, and PSU to "empty"
- [x] Verify the changes work correctly

## Changes Implemented
In `src/app/components/ComputerAssemblyChallenge.tsx`:

Update COMPONENT_TO_STATE_MAP:
```typescript
const COMPONENT_TO_STATE_MAP: Record<ComponentType, BuildState> = {
  "motherboard": "motherboard",  // → build-state-0.png
  "cpu": "cpu",                  // → build-state-1.png
  "cpu-cooler": "cpu-cooler",    // → build-state-2.png
  "ram1": "ram",                 // → build-state-3.png
  "gpu": "gpu",                  // → build-state-4.png
  "ssd": "empty",                // DOES NOT change build state
  "case-fan": "empty",           // DOES NOT change build state
  "psu": "empty",                // DOES NOT change build state
};
```

This ensures that only motherboard, CPU, CPU-cooler, RAM, and GPU update the build state (states 0-4).
SSD, case-fan, and PSU placed will not affect the main build state image.
