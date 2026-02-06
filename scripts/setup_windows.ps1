# Windows setup for Meta-Analytical PFC

Write-Host "Creating virtual environment..."
python -m venv .venv
.\.venv\Scripts\activate

Write-Host "Upgrading pip..."
python -m pip install --upgrade pip

Write-Host "Installing dependencies..."
pip install -r requirements.txt

Write-Host "If you have an RTX GPU, install CUDA-enabled PyTorch manually:"
Write-Host "  pip install torch --index-url https://download.pytorch.org/whl/cu121"

Write-Host "Optional: pre-download the local model"
Write-Host "  python scripts/download_model.py"
