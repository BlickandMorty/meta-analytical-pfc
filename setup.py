"""Setup for meta-analytical-pfc."""
from setuptools import setup, find_packages

setup(
    name="meta-analytical-pfc",
    version="0.1.0",
    description="Meta-analytical PFC: instrumented reasoning, causal inference, and adaptive learning for AI research",
    author="jojo",
    python_requires=">=3.10",
    packages=find_packages(exclude=["tests", "tests.*", "evaluation", "scripts", "training"]),
    install_requires=[
        "numpy>=1.24.0",
        "scipy>=1.10.0",
        "pyyaml>=6.0",
        "loguru>=0.7.0",
        "scikit-learn>=1.3.0",
        "python-dotenv>=1.0.0",
        "tqdm>=4.65.0",
        "networkx>=3.0",
    ],
    extras_require={
        "api": ["anthropic>=0.34.0", "sentence-transformers>=2.2.2", "chromadb>=0.4.0"],
        "local": ["torch>=2.0.0", "transformers>=4.40.0", "accelerate>=0.30.0"],
        "tda": ["ripser>=0.6.4"],
        "dashboard": ["fastapi>=0.110.0", "uvicorn>=0.29.0"],
        "dev": ["pytest>=7.0.0", "pytest-cov>=4.0.0"],
    },
)
