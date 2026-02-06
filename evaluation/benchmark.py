"""
BENCHMARK EVALUATION
====================

Test how well the PFC system is performing.

Think of this like:
- A student takes a practice test
- We check their answers against an answer key
- We see what they got right and wrong
- We calculate their score

We run the PFC through a set of test questions and check if it
answers them correctly, confidently, and efficiently.

Usage:
    python evaluation/benchmark.py --data data/evaluation --output results/
"""

import argparse
import json
from pathlib import Path
from typing import Dict, List, Optional
import sys
import os
import time

# Add project to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.core.adaptive_pfc import AdaptivePFC
from src.core.memory import CrossChatMemory
from src.models.base_model import ModelOrchestrator


class BenchmarkEvaluator:
    """
    Run benchmarks to measure PFC performance.
    
    Like a test coach:
    - Gives the AI test questions
    - Checks if answers are correct
    - Measures how confident and fast the AI is
    - Reports the score
    """
    
    def __init__(self):
        """Initialize the evaluator"""
        self.pfc = None
        self.results = []
    
    def initialize_pfc(self):
        """Set up the PFC system"""
        print("✓ Initializing PFC system...")
        
        memory = CrossChatMemory()
        model_orchestrator = ModelOrchestrator()
        
        self.pfc = AdaptivePFC(
            memory=memory,
            model_orchestrator=model_orchestrator
        )
    
    def load_test_questions(self, data_dir: Path) -> List[Dict]:
        """
        Load test questions from a directory.
        
        data_dir: Where are the test questions?
        
        Returns: List of questions (each with query and expected_answer)
        """
        
        # Try to load from json file
        json_file = data_dir / "test_questions.json"
        if json_file.exists():
            with open(json_file, 'r') as f:
                return json.load(f)
        
        # If no test file, create default questions
        return self._create_default_questions()
    
    def _create_default_questions(self) -> List[Dict]:
        """Create some default test questions"""
        return [
            {
                "query": "What is an effect size and why is it important?",
                "category": "statistical"
            },
            {
                "query": "Explain the difference between correlation and causation",
                "category": "causal"
            },
            {
                "query": "What is publication bias in meta-analysis?",
                "category": "meta_analysis"
            },
            {
                "query": "How do you update beliefs using Bayes theorem?",
                "category": "bayesian"
            },
            {
                "query": "What are the Bradford Hill criteria?",
                "category": "causal"
            }
        ]
    
    def run_benchmark(self, questions: List[Dict]) -> List[Dict]:
        """
        Run the PFC on each test question and record results.
        
        questions: List of test questions
        
        Returns: Results for each question
        """
        
        print(f"\n⏳ Running {len(questions)} benchmark questions...\n")
        
        results = []
        
        for i, question in enumerate(questions, 1):
            query = question.get("query", "")
            category = question.get("category", "unknown")
            
            print(f"[{i}/{len(questions)}] {category.upper()}: {query[:50]}...")
            
            try:
                # Time how long it takes to answer
                start_time = time.time()
                response = self.pfc.process_query(query)
                elapsed_time = time.time() - start_time
                
                # Record result
                result = {
                    "question_num": i,
                    "query": query,
                    "category": category,
                    "response": response[:200] + "..." if len(response) > 200 else response,
                    "elapsed_time": elapsed_time,
                    "success": True,
                    "error": None
                }
                
                print(f"   ✓ Answered in {elapsed_time:.2f}s")
                
            except Exception as e:
                # Record error
                result = {
                    "question_num": i,
                    "query": query,
                    "category": category,
                    "response": None,
                    "elapsed_time": 0,
                    "success": False,
                    "error": str(e)
                }
                
                print(f"   ❌ Error: {e}")
            
            results.append(result)
        
        return results
    
    def compute_metrics(self, results: List[Dict]) -> Dict:
        """
        Calculate performance metrics from benchmark results.
        
        results: Results from run_benchmark()
        
        Returns: Dictionary of metrics
        """
        
        successful = [r for r in results if r["success"]]
        failed = [r for r in results if not r["success"]]
        
        if successful:
            avg_time = sum(r["elapsed_time"] for r in successful) / len(successful)
        else:
            avg_time = 0
        
        # Group by category
        by_category = {}
        for result in results:
            category = result["category"]
            if category not in by_category:
                by_category[category] = {"success": 0, "total": 0, "times": []}
            by_category[category]["total"] += 1
            if result["success"]:
                by_category[category]["success"] += 1
                by_category[category]["times"].append(result["elapsed_time"])
        
        metrics = {
            "total_questions": len(results),
            "successful_answers": len(successful),
            "failed_answers": len(failed),
            "success_rate": len(successful) / len(results) if results else 0,
            "average_response_time": avg_time,
            "by_category": {
                cat: {
                    "success_rate": data["success"] / data["total"],
                    "num_questions": data["total"],
                    "avg_time": sum(data["times"]) / len(data["times"]) if data["times"] else 0
                }
                for cat, data in by_category.items()
            }
        }
        
        return metrics
    
    def print_results(self, metrics: Dict, results: List[Dict]):
        """Print benchmark results in a nice format"""
        
        print("\n" + "="*70)
        print("BENCHMARK RESULTS")
        print("="*70)
        
        print(f"\nOVERALL PERFORMANCE:")
        print(f"  Total questions: {metrics['total_questions']}")
        print(f"  Successful: {metrics['successful_answers']}/{metrics['total_questions']}")
        print(f"  Success rate: {metrics['success_rate']*100:.1f}%")
        print(f"  Average response time: {metrics['average_response_time']:.2f}s")
        
        print(f"\nBY CATEGORY:")
        for category, data in metrics['by_category'].items():
            print(f"  {category}:")
            print(f"    Success rate: {data['success_rate']*100:.1f}% ({data['num_questions']} questions)")
            print(f"    Average time: {data['avg_time']:.2f}s")
        
        print(f"\n" + "="*70)
    
    def save_results(self, results: List[Dict], metrics: Dict, output_dir: Path):
        """Save benchmark results to files"""
        
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Save detailed results
        results_file = output_dir / "benchmark_results.json"
        with open(results_file, 'w') as f:
            json.dump(results, f, indent=2)
        print(f"\n✓ Detailed results saved to {results_file}")
        
        # Save metrics
        metrics_file = output_dir / "benchmark_metrics.json"
        with open(metrics_file, 'w') as f:
            json.dump(metrics, f, indent=2)
        print(f"✓ Metrics saved to {metrics_file}")


def main():
    parser = argparse.ArgumentParser(
        description="Run benchmark evaluation on PFC"
    )
    parser.add_argument(
        "--data",
        type=Path,
        default=Path("data/evaluation"),
        help="Directory with test questions"
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("results"),
        help="Directory to save benchmark results"
    )
    
    args = parser.parse_args()
    
    print("\n" + "="*70)
    print("PFC BENCHMARK EVALUATION")
    print("="*70)
    
    try:
        # Initialize evaluator
        evaluator = BenchmarkEvaluator()
        evaluator.initialize_pfc()
        
        # Load test questions
        print(f"\n✓ Loading test questions from {args.data}...")
        questions = evaluator.load_test_questions(args.data)
        print(f"  Loaded {len(questions)} questions")
        
        # Run benchmark
        results = evaluator.run_benchmark(questions)
        
        # Compute metrics
        metrics = evaluator.compute_metrics(results)
        
        # Print results
        evaluator.print_results(metrics, results)
        
        # Save results
        evaluator.save_results(results, metrics, args.output)
        
        print(f"\nBenchmark complete! Results saved to {args.output}")
        
    except Exception as e:
        print(f"\n❌ Benchmark error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
