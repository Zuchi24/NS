import { useState } from "react";
import { Cable, CheckCircle, XCircle, Lightbulb, RotateCcw, ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { toast } from "sonner";

interface CableExercise {
  id: number;
  question: string;
  description: string;
  image: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  hint: string;
}

const exercises: CableExercise[] = [
  {
    id: 1,
    question: "Identify the cable type shown",
    description: "This cable has 8 wires arranged in a specific color pattern",
    image: "ethernet",
    options: ["Ethernet (Cat5e/Cat6)", "Coaxial Cable", "Fiber Optic", "Serial Cable"],
    correctAnswer: "Ethernet (Cat5e/Cat6)",
    explanation: "Ethernet cables (Cat5e/Cat6) contain 8 color-coded wires arranged in twisted pairs, commonly used for network connections.",
    hint: "Look for twisted pairs of colored wires - this is the most common network cable type.",
  },
  {
    id: 2,
    question: "What is the correct wiring standard for the highlighted configuration?",
    description: "Orange-White, Orange, Green-White, Blue, Blue-White, Green, Brown-White, Brown",
    image: "t568b",
    options: ["T568A", "T568B", "Crossover", "Rollover"],
    correctAnswer: "T568B",
    explanation: "T568B is one of the two standard wiring schemes for Ethernet cables. It starts with Orange-White, Orange, Green-White...",
    hint: "The pattern starts with orange colors - this is the most commonly used standard in North America.",
  },
  {
    id: 3,
    question: "Which cable type is immune to electromagnetic interference?",
    description: "Select the cable that uses light signals instead of electrical signals",
    image: "fiber",
    options: ["Coaxial Cable", "Twisted Pair", "Fiber Optic Cable", "Shielded Twisted Pair"],
    correctAnswer: "Fiber Optic Cable",
    explanation: "Fiber optic cables transmit data as light pulses through glass or plastic fibers, making them immune to EMI and supporting very high speeds.",
    hint: "This cable type uses light instead of electricity, making it perfect for long distances.",
  },
  {
    id: 4,
    question: "When would you use a crossover cable?",
    description: "Identify the correct use case for crossover wiring",
    image: "crossover",
    options: [
      "Computer to Switch",
      "Router to Router",
      "Computer to Router",
      "Switch to Modem"
    ],
    correctAnswer: "Router to Router",
    explanation: "Crossover cables are used to connect similar devices (router-to-router, switch-to-switch, or PC-to-PC) without an intermediary device.",
    hint: "Crossover cables connect similar devices directly to each other.",
  },
  {
    id: 5,
    question: "What is the maximum cable length for Cat6 Ethernet at 1Gbps?",
    description: "Choose the standard maximum distance for Cat6 cable",
    image: "length",
    options: ["50 meters", "100 meters", "185 meters", "500 meters"],
    correctAnswer: "100 meters",
    explanation: "The standard maximum length for Cat5e and Cat6 Ethernet cables is 100 meters (328 feet) for 1Gbps speeds to maintain signal integrity.",
    hint: "This is a standard networking distance - roughly the length of a football field.",
  },
];

export function CableWiringSimulation() {
  const [currentExercise, setCurrentExercise] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<number>>(new Set());

  const exercise = exercises[currentExercise];
  const isCorrect = selectedAnswer === exercise.correctAnswer;
  const progress = ((currentExercise + 1) / exercises.length) * 100;

  const handleAnswerSelect = (answer: string) => {
    if (!answeredQuestions.has(exercise.id)) {
      setSelectedAnswer(answer);
      setShowExplanation(true);
      
      if (answer === exercise.correctAnswer) {
        setCorrectAnswers(prev => prev + 1);
        toast.success("Correct! Well done!", {
          description: exercise.explanation,
        });
      } else {
        toast.error("Not quite right", {
          description: "Review the explanation and try the next question.",
        });
      }
      
      setAnsweredQuestions(prev => new Set(prev).add(exercise.id));
    }
  };

  const handleNext = () => {
    if (currentExercise < exercises.length - 1) {
      setCurrentExercise(prev => prev + 1);
      setSelectedAnswer(null);
      setShowHint(false);
      setShowExplanation(false);
    }
  };

  const handleReset = () => {
    setCurrentExercise(0);
    setSelectedAnswer(null);
    setShowHint(false);
    setShowExplanation(false);
    setCorrectAnswers(0);
    setAnsweredQuestions(new Set());
  };

  const getCableIcon = (type: string) => {
    const colors: Record<string, string> = {
      ethernet: "bg-blue-500",
      t568b: "bg-orange-500",
      fiber: "bg-purple-500",
      crossover: "bg-green-500",
      length: "bg-indigo-500",
    };
    return colors[type] || "bg-gray-500";
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
              <Cable className="w-6 h-6 text-white" />
            </div>
            Cable Wiring Identification
          </h1>
          <p className="text-gray-600 mt-2">Learn to identify and work with different network cable types</p>
        </div>
        <Button variant="outline" onClick={handleReset} className="gap-2">
          <RotateCcw className="w-4 h-4" />
          Reset
        </Button>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Progress</span>
              <span className="font-semibold">
                Question {currentExercise + 1} of {exercises.length}
              </span>
            </div>
            <Progress value={progress} className="h-3" />
            <div className="flex justify-between text-sm text-gray-600">
              <span>Score: {correctAnswers}/{answeredQuestions.size}</span>
              <span>{Math.round((correctAnswers / exercises.length) * 100)}% Accuracy</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Question Card */}
      <Card className="border-2">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-2xl mb-2">{exercise.question}</CardTitle>
              <CardDescription className="text-base">{exercise.description}</CardDescription>
            </div>
            <Badge variant="secondary" className="text-sm">
              Question {exercise.id}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Cable Visual */}
          <div className={`w-full h-40 ${getCableIcon(exercise.image)} rounded-lg flex items-center justify-center`}>
            <Cable className="w-20 h-20 text-white opacity-50" />
          </div>

          {/* Answer Options */}
          <div className="grid gap-3">
            {exercise.options.map((option) => {
              const isSelected = selectedAnswer === option;
              const isCorrectOption = option === exercise.correctAnswer;
              const showResult = showExplanation;

              return (
                <button
                  key={option}
                  onClick={() => handleAnswerSelect(option)}
                  disabled={answeredQuestions.has(exercise.id)}
                  className={`w-full p-4 text-left rounded-lg border-2 transition-all ${
                    showResult && isCorrectOption
                      ? "border-green-500 bg-green-50"
                      : showResult && isSelected && !isCorrect
                      ? "border-red-500 bg-red-50"
                      : isSelected
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-blue-300 hover:bg-blue-50"
                  } ${answeredQuestions.has(exercise.id) ? "cursor-not-allowed opacity-75" : "cursor-pointer"}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{option}</span>
                    {showResult && isCorrectOption && (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    )}
                    {showResult && isSelected && !isCorrect && (
                      <XCircle className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Hint Section */}
          {!showExplanation && (
            <Button
              variant="outline"
              onClick={() => setShowHint(!showHint)}
              className="w-full gap-2"
            >
              <Lightbulb className="w-4 h-4" />
              {showHint ? "Hide Hint" : "Show Hint"}
            </Button>
          )}

          {showHint && !showExplanation && (
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
              <div className="flex gap-3">
                <Lightbulb className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-yellow-900 mb-1">Hint</p>
                  <p className="text-sm text-yellow-800">{exercise.hint}</p>
                </div>
              </div>
            </div>
          )}

          {/* Explanation */}
          {showExplanation && (
            <div className={`border-2 rounded-lg p-4 ${
              isCorrect
                ? "bg-green-50 border-green-200"
                : "bg-blue-50 border-blue-200"
            }`}>
              <div className="flex gap-3">
                {isCorrect ? (
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <Lightbulb className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className={`font-semibold mb-1 ${
                    isCorrect ? "text-green-900" : "text-blue-900"
                  }`}>
                    {isCorrect ? "Correct!" : "Explanation"}
                  </p>
                  <p className={`text-sm ${
                    isCorrect ? "text-green-800" : "text-blue-800"
                  }`}>
                    {exercise.explanation}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          {showExplanation && currentExercise < exercises.length - 1 && (
            <Button onClick={handleNext} className="w-full gap-2" size="lg">
              Next Question
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}

          {showExplanation && currentExercise === exercises.length - 1 && (
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg p-6 text-center space-y-3">
              <h3 className="text-2xl font-bold">Simulation Complete! 🎉</h3>
              <p className="text-blue-100">
                You scored {correctAnswers} out of {exercises.length} ({Math.round((correctAnswers / exercises.length) * 100)}%)
              </p>
              <Button onClick={handleReset} variant="secondary" className="gap-2">
                <RotateCcw className="w-4 h-4" />
                Try Again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
