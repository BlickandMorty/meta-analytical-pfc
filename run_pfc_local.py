"""Run PFC in local-only mode (no API key required)."""

import os
os.environ["PFC_INFERENCE_MODE"] = "local"

from run_pfc import main

if __name__ == "__main__":
    main()
