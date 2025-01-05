// COPYRIGHT 2023 - 2025 The-Swarm-Corporation
// Converted By: MotoAcidic ( TFinch )

// User preferences object
export const userPreferences = {
    subjects: "AI Cognitive Architectures",
    learningStyle: "Visual",
    challengeLevel: "Moderate",
};

// Extracting individual preferences
export const { subjects, learningStyle, challengeLevel } = userPreferences;

// Curriculum Design Prompt
export const CURRICULUM_DESIGN_PROMPT = `
    Develop a semester-long curriculum tailored to student interests in ${subjects}. Focus on incorporating diverse teaching methods suitable for a ${learningStyle} learning style. 
    The curriculum should challenge students at a ${challengeLevel} level, integrating both theoretical knowledge and practical applications. Provide a detailed structure, including 
    weekly topics, key objectives, and essential resources needed.
`;

// Interactive Learning Session Prompt
export const INTERACTIVE_LEARNING_PROMPT = `
    Based on the curriculum, generate an interactive lesson plan for a student of ${subjects} that caters to a ${learningStyle} learning style. Incorporate engaging elements and hands-on activities.
`;

// Sample Lesson Prompt
export const SAMPLE_TEST_PROMPT = `
    Create a comprehensive sample test for the first week of the ${subjects} curriculum, tailored for a ${learningStyle} learning style and at a ${challengeLevel} challenge level.
`;

// Image Generation for Education Prompt
export const IMAGE_GENERATION_PROMPT = `
    Develop a stable diffusion prompt for an educational image/visual aid that align with the ${subjects} curriculum, specifically designed to enhance understanding for students with a ${learningStyle} 
    learning style. This might include diagrams, infographics, and illustrative representations to simplify complex concepts. Ensure you output a 10/10 descriptive image generation prompt only.
`;
