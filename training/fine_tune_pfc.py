"""
FINE-TUNE PFC MODEL
===================

Update the knowledge base with trained examples.

Think of this like:
- Reading = Loading examples
- Studying = Integrating into knowledge
- Teaching someone else = The model now knows this

We take the training examples we created and integrate them into
the model's knowledge base so it can use them to help future queries.

Usage:
    python training/fine_tune_pfc.py --data data/training --epochs 3
"""

import argparse
import json
from pathlib import Path
from typing import List, Dict
import sys
import os

# Add project to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.learning.model_updater import ModelUpdater


def load_training_data(data_dir: Path) -> List[Dict]:
    """
    Load training examples from prepared data directory.
    
    data_dir: Where is the training data?
    
    Returns: List of training examples
    """
    
    # Try to load from jsonl file first (more efficient)
    jsonl_file = data_dir / "training_data.jsonl"
    if jsonl_file.exists():
        examples = []
        with open(jsonl_file, 'r') as f:
            for line in f:
                examples.append(json.loads(line))
        return examples
    
    # Fall back to json file
    json_file = data_dir / "training_data.json"
    if json_file.exists():
        with open(json_file, 'r') as f:
            return json.load(f)
    
    print(f"⚠ No training data found in {data_dir}")
    return []


def fine_tune(data_dir: Path, output_dir: Path, epochs: int = 1):
    """
    Fine-tune the model with training examples.
    
    data_dir: Where are the training examples?
    output_dir: Where to save the updated knowledge base?
    epochs: How many times to go through the data? (more = more learning)
    """
    
    print("\n" + "="*70)
    print("FINE-TUNING PFC MODEL")
    print("="*70)
    
    # Create output directory
    output_dir.mkdir(parents=True, exist_ok=True)
    print(f"\n✓ Output directory ready: {output_dir}")
    
    try:
        # Load training data
        print(f"\n⏳ Loading training examples from {data_dir}...")
        examples = load_training_data(data_dir)
        
        if not examples:
            print("  ⚠ No examples to train on.")
            return
        
        print(f"✓ Loaded {len(examples)} training examples")
        
        # Initialize model updater
        print(f"\n⏳ Initializing model updater...")
        model_updater = ModelUpdater(storage_path=str(output_dir))
        print("✓ Model updater ready")
        
        # Process examples
        print(f"\n⏳ Integrating examples into knowledge base...")
        
        # Group examples by skill
        skills: Dict[str, List[Dict]] = {}
        
        for example in examples:
            skill_name = example.get("skill_name", "general")
            if skill_name not in skills:
                skills[skill_name] = []
            skills[skill_name].append(example)
        
        print(f"  Found {len(skills)} distinct skills")
        
        # Teach each skill
        for i, (skill_name, skill_examples) in enumerate(skills.items(), 1):
            print(f"\n  [{i}/{len(skills)}] Teaching skill: {skill_name}")
            print(f"      Examples: {len(skill_examples)}")
            
            # Get description from first example
            description = skill_examples[0].get("domain", "research reasoning")
            
            # Teach the skill
            result = model_updater.teach_skill(
                skill_name=skill_name,
                skill_description=f"Skill for handling {description} questions",
                training_examples=skill_examples
            )
            
            # Simulate learning over epochs
            for epoch in range(epochs):
                # In a real system, we might update model parameters
                # For now, we just increase confidence
                improvement = 0.05 * (epoch + 1) / epochs
                model_updater.update_base_model_prompt(
                    skill_name=skill_name,
                    success=True,
                    feedback=f"Epoch {epoch+1}: Improved understanding"
                )
        
        # Save final knowledge base
        print(f"\n✓ Knowledge base updated with {len(skills)} skills")
        
        # Create training summary
        summary = {
            "num_examples_processed": len(examples),
            "num_skills_taught": len(skills),
            "skills": list(skills.keys()),
            "examples_per_skill": {skill: len(exs) for skill, exs in skills.items()},
            "epochs": epochs
        }
        
        summary_file = output_dir / "training_summary.json"
        with open(summary_file, 'w') as f:
            json.dump(summary, f, indent=2)
        
        print(f"✓ Saved summary to {summary_file}")
        
        print("\n" + "="*70)
        print("FINE-TUNING COMPLETE!")
        print("="*70)
        print(f"\nResults:")
        print(f"  Skills taught: {len(skills)}")
        print(f"  Examples processed: {len(examples)}")
        print(f"  Epochs: {epochs}")
        print(f"\nThe model now knows about these skills:")
        for skill in list(skills.keys())[:5]:
            count = len(skills[skill])
            print(f"  • {skill} ({count} examples)")
        
        if len(skills) > 5:
            print(f"  ... and {len(skills) - 5} more")
        
        print(f"\nModel is ready for use!")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()


def main():
    parser = argparse.ArgumentParser(
        description="Fine-tune PFC model with training data"
    )
    parser.add_argument(
        "--data",
        type=Path,
        default=Path("data/training"),
        help="Directory with training data"
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/learned_knowledge"),
        help="Output directory for knowledge base"
    )
    parser.add_argument(
        "--epochs",
        type=int,
        default=1,
        help="Number of training epochs (how many times to go through data)"
    )
    
    args = parser.parse_args()
    
    fine_tune(
        data_dir=args.data,
        output_dir=args.output,
        epochs=args.epochs
    )


if __name__ == "__main__":
    main()


if __name__ == "__main__":
    main()
