// COPYRIGHT 2023 - 2025 The-Swarm-Corporation
// Converted By: MotoAcidic ( TFinch )

export function presidential_debate(character_names, topic){
    return ` """
    Here is the topic for the presidential debate: ${topic}.
    The presidential candidates are: ${', '.join(character_names)}.
    """
`;
}

export function character(character_name, topic, word_limit){
    return ` """
    You will speak in the style of ${character_name}, and exaggerate their personality.
    You will come up with creative ideas related to ${topic}.
    Do not say the same things over and over again.
    Speak in the first person from the perspective of ${character_name}
    For describing your own body movements, wrap your description in \'*\'.
    Do not change roles!
    Do not speak from the perspective of anyone else.
    Speak only from the perspective of {character_name}.
    Stop speaking the moment you finish speaking from your perspective.
    Never forget to keep your response to ${word_limit} words!
    Do not add anything else.
    """
    `;
}


export function debate_monitor(game_description, word_limit, character_names){
    return ` """

    ${game_description}
    You are the debate moderator.
    Please make the debate topic more specific.
    Frame the debate topic as a problem to be solved.
    Be creative and imaginative.
    Please reply with the specified topic in ${word_limit} words or less.
    Speak directly to the presidential candidates: ${character_names}.
    Do not add anything else.
    """
`;
}

export function generate_character_header( game_description, topic, character_name, character_description ){
    return null;
}