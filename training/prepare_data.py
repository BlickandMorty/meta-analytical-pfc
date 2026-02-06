"""
PREPARE TRAINING DATA
=====================

Convert executive traces into training data.

Think of this like:
- Raw materials = Executive traces (records of hard problems solved)
- Factory = This script
- Finished product = Training data ready to teach the base model

We take the raw "hard problems we solved" and turn them into
"textbook examples for teaching" in a format the model can learn from.

Usage:
    python training/prepare_data.py --input data/executive_traces --output data/training
"""

import argparse
import json
from pathlib import Path
from typing import List, Dict
import sys
import os

# Add project to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.learning.executive_trace import ExecutiveTraceMemory
from src.learning.pattern_detector import PatternDetector
from src.learning.training_generator import TrainingGenerator


def prepare_training_data(input_dir: Path, output_dir: Path, format: str = "jsonl"):
    """
    Convert executive traces to training data.
    
    input_dir: Where are the executive traces stored?
    output_dir: Where should we save the training data?
    format: "json" or "jsonl" (JSON Lines = one JSON object per line)
    """
    
    print("\n" + "="*70)
    print("PREPARING TRAINING DATA")
    print("="*70)
    
    # Create output directory
    output_dir.mkdir(parents=True, exist_ok=True)
    print(f"\n✓ Output directory ready: {output_dir}")
    
    try:
        # Load executive traces
        print(f"\n⏳ Loading executive traces from {input_dir}...")
        trace_memory = ExecutiveTraceMemory(storage_path=str(input_dir))
        traces = trace_memory.get_all()
        
        if not traces:
            print("  ⚠ No traces found. Nothing to prepare.")
            return
        
        print(f"✓ Loaded {len(traces)} traces")
        
        # Detect patterns
        print(f"\n⏳ Detecting patterns in traces...")
        pattern_detector = PatternDetector(min_cluster_size=2)
        patterns_result = pattern_detector.detect_patterns(traces)
        
        patterns = patterns_result.get("patterns", [])
        print(f"✓ Found {len(patterns)} pattern groups")
        
        # Generate training examples
        print(f"\n⏳ Generating training examples...")
        training_generator = TrainingGenerator()
        
        all_training_examples = []
        
        for pattern in patterns:
            skill_name = pattern["skill_name"]
            
            # Generate examples for this skill
            examples = training_generator.generate_training_examples(
                traces=traces,
                skill_name=skill_name,
                sample_size=5
            )
            
            all_training_examples.extend(examples)
            print(f"  ✓ {skill_name}: {len(examples)} examples")
        
        print(f"\n✓ Generated {len(all_training_examples)} total training examples")
        
        # Save training data
        print(f"\n⏳ Saving training data as {format}...")
        
        if format == "json":
            # Save as single JSON file
            output_file = output_dir / "training_data.json"
            examples_data = [ex.to_dict() for ex in all_training_examples]
            
            with open(output_file, 'w') as f:
                json.dump(examples_data, f, indent=2)
            
            print(f"✓ Saved to {output_file}")
        
        elif format == "jsonl":
            # Save as JSON Lines (one example per line)
            output_file = output_dir / "training_data.jsonl"
            
            with open(output_file, 'w') as f:
                for example in all_training_examples:
                    f.write(json.dumps(example.to_dict()) + "\n")
            
            print(f"✓ Saved to {output_file} ({len(all_training_examples)} lines)")
        
        # Create metadata file
        metadata = {
            "num_traces": len(traces),
            "num_patterns": len(patterns),
            "num_examples": len(all_training_examples),
            "patterns": [
                {
                    "skill": p["skill_name"],
                    "size": p["size"],
                    "examples_generated": len([e for e in all_training_examples if e.skill_name == p["skill_name"]])
                }
                for p in patterns
            ]
        }
        
        metadata_file = output_dir / "metadata.json"
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        print(f"✓ Saved metadata to {metadata_file}")
        
        print("\n" + "="*70)
        print("TRAINING DATA PREPARATION COMPLETE!")
        print("="*70)
        print(f"\nSummary:")
        print(f"  Input:  {len(traces)} executive traces")
        print(f"  Patterns: {len(patterns)} groups")
        print(f"  Output: {len(all_training_examples)} training examples")
        print(f"\nReady to teach the model!")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()


def main():
    parser = argparse.ArgumentParser(
        description="Prepare training data from executive traces"
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=Path("data/executive_traces"),
        help="Directory with executive traces"
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/training"),
        help="Output directory for training data"
    )
    parser.add_argument(
        "--format",
        choices=["json", "jsonl"],
        default="jsonl",
        help="Output format"
    )
    
    args = parser.parse_args()
    
    prepare_training_data(
        input_dir=args.input,
        output_dir=args.output,
        format=args.format
    )


if __name__ == "__main__":
    main()
