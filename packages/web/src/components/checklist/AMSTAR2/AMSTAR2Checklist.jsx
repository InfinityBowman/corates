import { createSignal, createEffect, Show, For } from 'solid-js';
import { AMSTAR_CHECKLIST } from './checklist-map.js';
import { createChecklist as createAMSTAR2Checklist } from './checklist.js';
import { FaSolidCircleInfo } from 'solid-icons/fa';
import { Tooltip } from '@corates/ui';
import NoteEditor from '@/components/checklist/common/NoteEditor.jsx';

export function Question1(props) {
  const state = () => props.checklistState().q1;
  const question = AMSTAR_CHECKLIST.q1;

  function handleChange(colIdx, optIdx) {
    const newAnswers = state().answers.map(arr => [...arr]);
    newAnswers[colIdx][optIdx] = !state().answers[colIdx][optIdx];

    // If first column changed, update Yes/No in last column
    if (colIdx === 0) {
      const allChecked = newAnswers[0].every(Boolean);
      newAnswers[2][0] = allChecked; // Yes
      newAnswers[2][1] = !allChecked; // No
    }

    // If Yes/No column changed, ensure mutual exclusivity
    if (colIdx === 2) {
      if (optIdx === 0 && newAnswers[2][0]) newAnswers[2][1] = false;
      if (optIdx === 1 && newAnswers[2][1]) newAnswers[2][0] = false;
    }

    // Update the whole q1 object, only changing answers
    const newQ1 = { ...props.checklistState().q1, answers: newAnswers };
    props.onUpdate(newQ1);
  }

  return (
    <StandardQuestion state={state} question={question} handleChange={handleChange} {...props} />
  );
}

export function Question2(props) {
  const state = () => props.checklistState().q2;
  const question = AMSTAR_CHECKLIST.q2;

  function handleChange(colIdx, optIdx) {
    const newAnswers = state().answers.map(arr => [...arr]);
    newAnswers[colIdx][optIdx] = !state().answers[colIdx][optIdx];

    // If first or second column changed, update Yes/Partial Yes/No in last column
    if (colIdx === 0 || colIdx === 1) {
      const allPartialYes = newAnswers[0].every(Boolean);
      const allYes = allPartialYes && newAnswers[1].every(Boolean);

      newAnswers[2][0] = allYes; // Yes
      newAnswers[2][1] = !allYes && allPartialYes; // Partial Yes
      newAnswers[2][2] = !allYes && !allPartialYes; // No
    }

    // If last column changed, ensure mutual exclusivity
    if (colIdx === 2) {
      newAnswers[2] = newAnswers[2].map((v, i) =>
        i === optIdx ? !state().answers[2][optIdx] : false,
      );
    }
    const newQ2 = { ...props.checklistState().q2, answers: newAnswers };
    props.onUpdate(newQ2);
  }

  return (
    <StandardQuestion state={state} question={question} handleChange={handleChange} {...props} />
  );
}

export function Question3(props) {
  const state = () => props.checklistState().q3;
  const question = AMSTAR_CHECKLIST.q3;

  function handleChange(colIdx, optIdx) {
    const newAnswers = state().answers.map(arr => [...arr]);
    newAnswers[colIdx][optIdx] = !state().answers[colIdx][optIdx];

    // If first column changed, update Yes/No in last column
    if (colIdx === 0) {
      const anyChecked = newAnswers[0].some(Boolean);
      newAnswers[1][0] = anyChecked; // Yes
      newAnswers[1][1] = !anyChecked; // No
    }

    // If Yes/No column changed, ensure mutual exclusivity
    if (colIdx === 1) {
      if (optIdx === 0 && newAnswers[1][0]) newAnswers[1][1] = false;
      if (optIdx === 1 && newAnswers[1][1]) newAnswers[1][0] = false;
    }

    // Update the whole q3 object, only changing answers
    const newQ3 = { ...props.checklistState().q3, answers: newAnswers };
    props.onUpdate(newQ3);
  }

  return (
    <StandardQuestion state={state} question={question} handleChange={handleChange} {...props} />
  );
}

export function Question4(props) {
  const state = () => props.checklistState().q4;
  const question = AMSTAR_CHECKLIST.q4;

  function handleChange(colIdx, optIdx) {
    const newAnswers = state().answers.map(arr => [...arr]);
    newAnswers[colIdx][optIdx] = !state().answers[colIdx][optIdx];

    // If first or second column changed, update Yes/Partial Yes/No in last column
    if (colIdx === 0 || colIdx === 1) {
      const allPartialYes = newAnswers[0].every(Boolean);
      const allYes = allPartialYes && newAnswers[1].every(Boolean);

      newAnswers[2][0] = allYes; // Yes
      newAnswers[2][1] = !allYes && allPartialYes; // Partial Yes
      newAnswers[2][2] = !allYes && !allPartialYes; // No
    }

    // If last column changed, ensure mutual exclusivity
    if (colIdx === 2) {
      newAnswers[2] = newAnswers[2].map((v, i) =>
        i === optIdx ? !state().answers[2][optIdx] : false,
      );
    }

    // Update the whole q4 object, only changing answers
    const newQ4 = { ...props.checklistState().q4, answers: newAnswers };
    props.onUpdate(newQ4);
  }

  return (
    <StandardQuestion state={state} question={question} handleChange={handleChange} {...props} />
  );
}

export function Question5(props) {
  const state = () => props.checklistState().q5;
  const question = AMSTAR_CHECKLIST.q5;

  function handleChange(colIdx, optIdx) {
    const newAnswers = state().answers.map(arr => [...arr]);
    newAnswers[colIdx][optIdx] = !state().answers[colIdx][optIdx];

    // If first column changed, update Yes/No in last column
    if (colIdx === 0) {
      const anyChecked = newAnswers[0].some(Boolean);
      newAnswers[1][0] = anyChecked; // Yes
      newAnswers[1][1] = !anyChecked; // No
    }

    // If Yes/No column changed, ensure mutual exclusivity
    if (colIdx === 1) {
      if (optIdx === 0 && newAnswers[1][0]) newAnswers[1][1] = false;
      if (optIdx === 1 && newAnswers[1][1]) newAnswers[1][0] = false;
    }

    const newQ5 = { ...props.checklistState().q5, answers: newAnswers };
    props.onUpdate(newQ5);
  }

  return (
    <StandardQuestion state={state} question={question} handleChange={handleChange} {...props} />
  );
}

export function Question6(props) {
  const state = () => props.checklistState().q6;
  const question = AMSTAR_CHECKLIST.q6;

  function handleChange(colIdx, optIdx) {
    const newAnswers = state().answers.map(arr => [...arr]);
    newAnswers[colIdx][optIdx] = !state().answers[colIdx][optIdx];

    // If first column changed, update Yes/No in last column
    if (colIdx === 0) {
      const anyChecked = newAnswers[0].some(Boolean);
      newAnswers[1][0] = anyChecked; // Yes
      newAnswers[1][1] = !anyChecked; // No
    }

    // If Yes/No column changed, ensure mutual exclusivity
    if (colIdx === 1) {
      if (optIdx === 0 && newAnswers[1][0]) newAnswers[1][1] = false;
      if (optIdx === 1 && newAnswers[1][1]) newAnswers[1][0] = false;
    }

    const newQ6 = { ...props.checklistState().q6, answers: newAnswers };
    props.onUpdate(newQ6);
  }

  return (
    <StandardQuestion state={state} question={question} handleChange={handleChange} {...props} />
  );
}

export function Question7(props) {
  const state = () => props.checklistState().q7;
  const question = AMSTAR_CHECKLIST.q7;

  function handleChange(colIdx, optIdx) {
    const newAnswers = state().answers.map(arr => [...arr]);
    newAnswers[colIdx][optIdx] = !state().answers[colIdx][optIdx];

    // If first or second column changed, update Yes/Partial Yes/No in last column
    if (colIdx === 0 || colIdx === 1) {
      const allPartialYes = newAnswers[0].every(Boolean);
      const allYes = allPartialYes && newAnswers[1].every(Boolean);

      newAnswers[2][0] = allYes; // Yes
      newAnswers[2][1] = !allYes && allPartialYes; // Partial Yes
      newAnswers[2][2] = !allYes && !allPartialYes; // No
    }

    // If last column changed, ensure mutual exclusivity
    if (colIdx === 2) {
      newAnswers[2] = newAnswers[2].map((v, i) =>
        i === optIdx ? !state().answers[2][optIdx] : false,
      );
    }

    const newQ7 = { ...props.checklistState().q7, answers: newAnswers };
    props.onUpdate(newQ7);
  }

  return (
    <StandardQuestion state={state} question={question} handleChange={handleChange} {...props} />
  );
}

export function Question8(props) {
  const state = () => props.checklistState().q8;
  const question = AMSTAR_CHECKLIST.q8;

  function handleChange(colIdx, optIdx) {
    const newAnswers = state().answers.map(arr => [...arr]);
    newAnswers[colIdx][optIdx] = !state().answers[colIdx][optIdx];

    // If first or second column changed, update Yes/Partial Yes/No in last column
    if (colIdx === 0 || colIdx === 1) {
      const allPartialYes = newAnswers[0].every(Boolean);
      const allYes = allPartialYes && newAnswers[1].every(Boolean);

      newAnswers[2][0] = allYes; // Yes
      newAnswers[2][1] = !allYes && allPartialYes; // Partial Yes
      newAnswers[2][2] = !allYes && !allPartialYes; // No
    }

    // If last column changed, ensure mutual exclusivity
    if (colIdx === 2) {
      newAnswers[2] = newAnswers[2].map((v, i) =>
        i === optIdx ? !state().answers[2][optIdx] : false,
      );
    }

    const newQ8 = { ...props.checklistState().q8, answers: newAnswers };
    props.onUpdate(newQ8);
  }

  return (
    <StandardQuestion state={state} question={question} handleChange={handleChange} {...props} />
  );
}

export function Question9(props) {
  const stateA = () => props.checklistState().q9a;
  const stateB = () => props.checklistState().q9b;
  const question = AMSTAR_CHECKLIST.q9;

  function handleChangeA(colIdx, optIdx) {
    const newAnswersA = stateA().answers.map(arr => [...arr]);
    newAnswersA[colIdx][optIdx] = !stateA().answers[colIdx][optIdx];

    // If first or second column changed, update Yes/Partial Yes/No/Not applicable in last column
    if (colIdx === 0 || colIdx === 1) {
      const allPartialYes = newAnswersA[0].every(Boolean);
      const allYes = allPartialYes && newAnswersA[1].every(Boolean);

      newAnswersA[2][0] = allYes; // Yes
      newAnswersA[2][1] = !allYes && allPartialYes; // Partial Yes
      newAnswersA[2][2] = !allYes && !allPartialYes; // No
      newAnswersA[2][3] = false; // Not applicable
    }

    // If last column changed, ensure mutual exclusivity
    if (colIdx === 2) {
      newAnswersA[2] = newAnswersA[2].map((v, i) =>
        i === optIdx ? !stateA().answers[2][optIdx] : false,
      );
    }

    const newQ9a = { ...props.checklistState().q9a, answers: newAnswersA };
    props.onUpdatea(newQ9a);
  }

  function handleChangeB(colIdx, optIdx) {
    const newAnswersB = stateB().answers.map(arr => [...arr]);
    newAnswersB[colIdx][optIdx] = !stateB().answers[colIdx][optIdx];

    // If first or second column changed, update Yes/Partial Yes/No/Not applicable in last column
    if (colIdx === 0 || colIdx === 1) {
      const allPartialYes = newAnswersB[0].every(Boolean);
      const allYes = allPartialYes && newAnswersB[1].every(Boolean);

      newAnswersB[2][0] = allYes; // Yes
      newAnswersB[2][1] = !allYes && allPartialYes; // Partial Yes
      newAnswersB[2][2] = !allYes && !allPartialYes; // No
      newAnswersB[2][3] = false; // Not applicable
    }

    // If last column changed, ensure mutual exclusivity
    if (colIdx === 2) {
      newAnswersB[2] = newAnswersB[2].map((v, i) =>
        i === optIdx ? !stateB().answers[2][optIdx] : false,
      );
    }

    const newQ9b = { ...props.checklistState().q9b, answers: newAnswersB };
    props.onUpdateb(newQ9b);
  }

  function onUpdateab(newQ) {
    const newCritical = newQ.critical;
    const newQa = { ...stateA(), critical: newCritical };
    const newQb = { ...stateB(), critical: newCritical };
    props.onUpdatea(newQa);
    setTimeout(() => {
      props.onUpdateb(newQb);
    }, 10);
  }

  // Get Y.Text for the note (q9 is parent key for q9a/q9b)
  const noteYText = () => {
    if (!props.getQuestionNote) return null;
    return props.getQuestionNote('q9');
  };

  let containerRef;

  return (
    <div class='relative rounded-lg bg-white p-8 text-sm shadow-md' ref={el => (containerRef = el)}>
      <QuestionInfo question={question} containerRef={containerRef} />
      <div class='flex'>
        <h3 class='font-semibold text-gray-900'>{question.text}</h3>
        <CriticalButton state={stateA} onUpdate={onUpdateab} />
      </div>
      <div class='mt-2 mb-1 h-4 font-semibold text-gray-900'>{question.subtitle}</div>
      <StandardQuestionInternal
        state={stateA}
        question={{ text: 'q9a' }}
        columns={question.columns}
        handleChange={handleChangeA}
      />
      <div class='mt-2 h-4 font-semibold text-gray-900'>{question.subtitle2}</div>
      <StandardQuestionInternal
        state={stateB}
        question={{ text: 'q9b' }}
        columns={question.columns2}
        handleChange={handleChangeB}
      />
      <Show when={props.getQuestionNote}>
        <NoteEditor yText={noteYText()} readOnly={props.readOnly} collapsed={true} />
      </Show>
    </div>
  );
}

export function Question10(props) {
  const state = () => props.checklistState().q10;
  const question = AMSTAR_CHECKLIST.q10;

  function handleChange(colIdx, optIdx) {
    const newAnswers = state().answers.map(arr => [...arr]);
    newAnswers[colIdx][optIdx] = !state().answers[colIdx][optIdx];

    // If first column changed, update Yes/No in last column
    if (colIdx === 0) {
      const anyChecked = newAnswers[0].some(Boolean);
      newAnswers[1][0] = anyChecked; // Yes
      newAnswers[1][1] = !anyChecked; // No
    }

    // If Yes/No column changed, ensure mutual exclusivity
    if (colIdx === 1) {
      if (optIdx === 0 && newAnswers[1][0]) newAnswers[1][1] = false;
      if (optIdx === 1 && newAnswers[1][1]) newAnswers[1][0] = false;
    }

    const newQ10 = { ...props.checklistState().q10, answers: newAnswers };
    props.onUpdate(newQ10);
  }

  return (
    <StandardQuestion state={state} question={question} handleChange={handleChange} {...props} />
  );
}

export function Question11(props) {
  const stateA = () => props.checklistState().q11a;
  const stateB = () => props.checklistState().q11b;
  const question = AMSTAR_CHECKLIST.q11;

  function handleChangeA(colIdx, optIdx) {
    const newAnswersA = stateA().answers.map(arr => [...arr]);
    newAnswersA[colIdx][optIdx] = !stateA().answers[colIdx][optIdx];

    // If first column changed, update Yes/No/No meta-analysis conducted in last column
    if (colIdx === 0) {
      const allChecked = newAnswersA[0].every(Boolean);
      newAnswersA[1][0] = allChecked; // Yes
      newAnswersA[1][1] = !allChecked; // No
      newAnswersA[1][2] = false; // No meta-analysis conducted
    }

    // If last column changed, ensure mutual exclusivity
    if (colIdx === 1) {
      newAnswersA[1] = newAnswersA[1].map((v, i) =>
        i === optIdx ? !stateA().answers[1][optIdx] : false,
      );
    }

    const newQ11a = { ...props.checklistState().q11a, answers: newAnswersA };
    props.onUpdatea(newQ11a);
  }

  function handleChangeB(colIdx, optIdx) {
    const newAnswersB = stateB().answers.map(arr => [...arr]);
    newAnswersB[colIdx][optIdx] = !stateB().answers[colIdx][optIdx];

    // If first column changed, update Yes/No/No meta-analysis conducted in last column
    if (colIdx === 0) {
      const allChecked = newAnswersB[0].every(Boolean);
      newAnswersB[1][0] = allChecked; // Yes
      newAnswersB[1][1] = !allChecked; // No
      newAnswersB[1][2] = false; // No meta-analysis conducted
    }

    // If last column changed, ensure mutual exclusivity
    if (colIdx === 1) {
      newAnswersB[1] = newAnswersB[1].map((v, i) =>
        i === optIdx ? !stateB().answers[1][optIdx] : false,
      );
    }

    const newQ11b = { ...props.checklistState().q11b, answers: newAnswersB };
    props.onUpdateb(newQ11b);
  }

  function onUpdateab(newQ) {
    const newCritical = newQ.critical;
    const newQa = { ...stateA(), critical: newCritical };
    const newQb = { ...stateB(), critical: newCritical };
    props.onUpdatea(newQa);
    setTimeout(() => {
      props.onUpdateb(newQb);
    }, 10);
  }

  // Get Y.Text for the note (q11 is parent key for q11a/q11b)
  const noteYText = () => {
    if (!props.getQuestionNote) return null;
    return props.getQuestionNote('q11');
  };

  let containerRef;

  return (
    <div class='relative rounded-lg bg-white p-8 text-sm shadow-md' ref={el => (containerRef = el)}>
      <QuestionInfo question={question} containerRef={containerRef} />
      <div class='flex'>
        <h3 class='font-semibold text-gray-900'>{question.text}</h3>
        <CriticalButton state={stateA} onUpdate={onUpdateab} />
      </div>

      <div class='mt-2 h-4 font-semibold text-gray-900'>{question.subtitle}</div>
      <StandardQuestionInternal
        state={stateA}
        question={{ text: 'q11a' }}
        columns={question.columns}
        handleChange={handleChangeA}
        width='w-48'
      />
      <div class='mt-4 h-4 font-semibold text-gray-900'>{question.subtitle2}</div>
      <StandardQuestionInternal
        state={stateB}
        question={{ text: 'q11b' }}
        columns={question.columns2}
        handleChange={handleChangeB}
        width='w-48'
      />
      <Show when={props.getQuestionNote}>
        <NoteEditor yText={noteYText()} readOnly={props.readOnly} collapsed={true} />
      </Show>
    </div>
  );
}

export function Question12(props) {
  const state = () => props.checklistState().q12;
  const question = AMSTAR_CHECKLIST.q12;

  function handleChange(colIdx, optIdx) {
    const newAnswers = state().answers.map(arr => [...arr]);
    newAnswers[colIdx][optIdx] = !state().answers[colIdx][optIdx];

    // If first column changed, update Yes/No/No meta-analysis conducted in last column
    if (colIdx === 0) {
      const anyChecked = newAnswers[0].some(Boolean);
      newAnswers[1][0] = anyChecked; // Yes
      newAnswers[1][1] = !anyChecked; // No
      newAnswers[1][2] = false; // No meta-analysis conducted
    }

    // If last column changed, ensure mutual exclusivity
    if (colIdx === 1) {
      newAnswers[1] = newAnswers[1].map((v, i) =>
        i === optIdx ? !state().answers[1][optIdx] : false,
      );
    }

    const newQ12 = { ...props.checklistState().q12, answers: newAnswers };
    props.onUpdate(newQ12);
  }

  return (
    <StandardQuestion
      state={state}
      question={question}
      handleChange={handleChange}
      {...props}
      width='w-48'
    />
  );
}

export function Question13(props) {
  const state = () => props.checklistState().q13;
  const question = AMSTAR_CHECKLIST.q13;

  function handleChange(colIdx, optIdx) {
    const newAnswers = state().answers.map(arr => [...arr]);
    newAnswers[colIdx][optIdx] = !state().answers[colIdx][optIdx];

    // If first column changed, update Yes/No in last column
    if (colIdx === 0) {
      const anyChecked = newAnswers[0].some(Boolean);
      newAnswers[1][0] = anyChecked; // Yes
      newAnswers[1][1] = !anyChecked; // No
    }

    // If Yes/No column changed, ensure mutual exclusivity
    if (colIdx === 1) {
      if (optIdx === 0 && newAnswers[1][0]) newAnswers[1][1] = false;
      if (optIdx === 1 && newAnswers[1][1]) newAnswers[1][0] = false;
    }

    const newQ13 = { ...props.checklistState().q13, answers: newAnswers };
    props.onUpdate(newQ13);
  }

  return (
    <StandardQuestion state={state} question={question} handleChange={handleChange} {...props} />
  );
}

export function Question14(props) {
  const state = () => props.checklistState().q14;
  const question = AMSTAR_CHECKLIST.q14;

  function handleChange(colIdx, optIdx) {
    const newAnswers = state().answers.map(arr => [...arr]);
    newAnswers[colIdx][optIdx] = !state().answers[colIdx][optIdx];

    // If first column changed, update Yes/No in last column
    if (colIdx === 0) {
      const anyChecked = newAnswers[0].some(Boolean);
      newAnswers[1][0] = anyChecked; // Yes
      newAnswers[1][1] = !anyChecked; // No
    }

    // If Yes/No column changed, ensure mutual exclusivity
    if (colIdx === 1) {
      if (optIdx === 0 && newAnswers[1][0]) newAnswers[1][1] = false;
      if (optIdx === 1 && newAnswers[1][1]) newAnswers[1][0] = false;
    }

    const newQ14 = { ...props.checklistState().q14, answers: newAnswers };
    props.onUpdate(newQ14);
  }

  return (
    <StandardQuestion state={state} question={question} handleChange={handleChange} {...props} />
  );
}

export function Question15(props) {
  const state = () => props.checklistState().q15;
  const question = AMSTAR_CHECKLIST.q15;

  function handleChange(colIdx, optIdx) {
    const newAnswers = state().answers.map(arr => [...arr]);
    newAnswers[colIdx][optIdx] = !state().answers[colIdx][optIdx];

    // If first column changed, update Yes/No/No meta-analysis conducted in last column
    if (colIdx === 0) {
      const anyChecked = newAnswers[0].some(Boolean);
      newAnswers[1][0] = anyChecked; // Yes
      newAnswers[1][1] = !anyChecked; // No
      newAnswers[1][2] = false; // No meta-analysis conducted
    }

    // If last column changed, ensure mutual exclusivity
    if (colIdx === 1) {
      newAnswers[1] = newAnswers[1].map((v, i) =>
        i === optIdx ? !state().answers[1][optIdx] : false,
      );
    }

    const newQ15 = { ...props.checklistState().q15, answers: newAnswers };
    props.onUpdate(newQ15);
  }

  return (
    <StandardQuestion
      state={state}
      question={question}
      handleChange={handleChange}
      {...props}
      width='w-48'
    />
  );
}

export function Question16(props) {
  const state = () => props.checklistState().q16;
  const question = AMSTAR_CHECKLIST.q16;

  function handleChange(colIdx, optIdx) {
    const newAnswers = state().answers.map(arr => [...arr]);
    newAnswers[colIdx][optIdx] = !state().answers[colIdx][optIdx];

    // If first column changed, update Yes/No in last column
    if (colIdx === 0) {
      const anyChecked = newAnswers[0].some(Boolean);
      newAnswers[1][0] = anyChecked; // Yes
      newAnswers[1][1] = !anyChecked; // No
    }

    // If Yes/No column changed, ensure mutual exclusivity
    if (colIdx === 1) {
      if (optIdx === 0 && newAnswers[1][0]) newAnswers[1][1] = false;
      if (optIdx === 1 && newAnswers[1][1]) newAnswers[1][0] = false;
    }

    const newQ16 = { ...props.checklistState().q16, answers: newAnswers };
    props.onUpdate(newQ16);
  }

  return (
    <StandardQuestion state={state} question={question} handleChange={handleChange} {...props} />
  );
}

function StandardQuestion(props) {
  let containerRef;

  // Get the question key from the question text (e.g., "1. Did..." -> "q1")
  const questionKey = () => {
    const text = props.question?.text || '';
    const match = text.match(/^(\d+[a-z]?)\./);
    return match ? `q${match[1]}` : null;
  };

  // Get Y.Text for the note if getQuestionNote is available
  const noteYText = () => {
    const key = questionKey();
    if (!key || !props.getQuestionNote) return null;
    return props.getQuestionNote(key);
  };

  return (
    <div class='relative rounded-lg bg-white p-7 pb-3 shadow-md' ref={el => (containerRef = el)}>
      <QuestionInfo question={props.question} containerRef={containerRef} />
      <div class='flex'>
        <h3 class='mb-1 text-sm font-semibold text-gray-900'>{props.question.text}</h3>
        <CriticalButton state={props.state} onUpdate={props.onUpdate} />
      </div>
      <StandardQuestionInternal columns={props.question.columns} {...props} />
      <Show when={props.getQuestionNote}>
        <NoteEditor yText={noteYText()} readOnly={props.readOnly} collapsed={true} />
      </Show>
    </div>
  );
}

function QuestionInfo(props) {
  return (
    <>
      <div class='absolute top-1.5 right-1.5'>
        <Tooltip content={props.question.info} placement='top' openDelay={200}>
          <div class='inline-flex items-center justify-center rounded-full p-1.5 opacity-70 hover:opacity-100 focus:opacity-100 focus:ring-2 focus:ring-blue-500 focus:outline-none'>
            <FaSolidCircleInfo size={12} />
          </div>
        </Tooltip>
      </div>
    </>
  );
}

function CriticalButton(props) {
  function onUpdateCritical(critical) {
    const newQ = { ...props.state(), critical: critical };
    props.onUpdate(newQ);
  }
  return (
    <div class='ml-auto'>
      <button
        class={`ml-2 h-6 rounded-full px-3 text-xs font-medium text-nowrap transition-colors ${
          props.state().critical ?
            'border border-red-300 bg-red-100 text-red-700 hover:bg-red-200'
          : 'border border-gray-300 bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
        onClick={() => onUpdateCritical(!props.state().critical)}
        aria-pressed={props.state().critical}
      >
        {props.state().critical ? 'Critical' : 'Not Critical'}
      </button>
    </div>
  );
}

function StandardQuestionInternal(props) {
  return (
    <div class='flex flex-col gap-4 sm:flex-row sm:gap-6'>
      <For each={props.columns}>
        {(col, colIdx) => (
          <div
            class={
              colIdx() === props.columns.length - 1 ?
                `${props.width ?? 'w-32'} flex min-w-0 flex-col`
              : 'flex min-w-0 flex-1 flex-col'
            }
          >
            <div class='wrap-break-words flex min-h-8 w-full min-w-0 items-center text-xs font-semibold whitespace-normal text-gray-800'>
              {col.label}
            </div>
            <Show when={col.description}>
              <div class='wrap-break-words -mt-1 mb-2 flex items-center text-xs text-gray-800'>
                {col.description}
              </div>
            </Show>
            {colIdx() === props.columns.length - 1 ?
              <div class='mt-1 flex flex-col gap-2'>
                <For each={col.options}>
                  {(option, optIdx) => (
                    <label class='flex items-center space-x-2 text-xs'>
                      <input
                        type='radio'
                        name={`col-${colIdx()}-${props.question?.text ?? ''}`}
                        checked={props.state().answers[colIdx()][optIdx()]}
                        onChange={() => props.handleChange(colIdx(), optIdx())}
                        class='h-3.5 w-3.5 cursor-pointer border-gray-300 text-blue-600 focus:ring-blue-500'
                      />
                      <span class='wrap-break-words text-gray-700'>{option}</span>
                    </label>
                  )}
                </For>
              </div>
            : <div class='flex flex-col gap-2'>
                <For each={col.options}>
                  {(option, optIdx) => (
                    <label class='flex items-center space-x-2 text-xs'>
                      <input
                        type='checkbox'
                        checked={props.state().answers[colIdx()][optIdx()]}
                        onChange={() => props.handleChange(colIdx(), optIdx())}
                        class='h-3 w-3 shrink-0 border-gray-300 text-blue-600 focus:ring-blue-500'
                      />
                      <span class='wrap-break-words text-gray-700'>{option}</span>
                    </label>
                  )}
                </For>
              </div>
            }
          </div>
        )}
      </For>
    </div>
  );
}

export default function AMSTAR2Checklist(props = {}) {
  const [currentChecklist, setCurrentChecklist] = createSignal(null);

  // If an external checklist is supplied (from Yjs DO), use that as the source of truth.
  createEffect(() => {
    if (props.externalChecklist) {
      setCurrentChecklist(props.externalChecklist);
      return;
    }

    // fallback: initialize a fresh checklist when not externally provided
    const newChecklist = createAMSTAR2Checklist({
      name: 'New Checklist',
      id: 'local-1234',
      createdAt: Date.now(),
      reviewerName: '',
      reviewDate: '',
    });
    setCurrentChecklist(newChecklist);
  });

  // Handler to update checklist state
  const handleChecklistChange = newState => {
    if (props.readOnly) return;
    // If parent provided a controlled update handler, forward the partial update
    if (props.onExternalUpdate) {
      props.onExternalUpdate(newState);
      return;
    }

    // Otherwise update local state by merging
    const prevChecklist = currentChecklist();
    const updatedChecklist = { ...prevChecklist, ...newState };
    setCurrentChecklist(updatedChecklist);
  };

  return (
    <div class='bg-blue-50'>
      <div class='container mx-auto max-w-5xl px-4 py-6'>
        <Show when={currentChecklist()} fallback={<div>Loading...</div>}>
          <div class='mb-6 text-left text-lg font-semibold text-gray-900 sm:text-center'>
            {currentChecklist().name || 'AMSTAR 2 Checklist'}
          </div>
          <fieldset disabled={!!props.readOnly} class={props.readOnly ? 'opacity-90' : ''}>
            <div class='space-y-6'>
              <Question1
                onUpdate={newQ1 => handleChecklistChange({ q1: newQ1 })}
                checklistState={currentChecklist}
                getQuestionNote={props.getQuestionNote}
                readOnly={props.readOnly}
              />
              <Question2
                onUpdate={newQ2 => handleChecklistChange({ q2: newQ2 })}
                checklistState={currentChecklist}
                getQuestionNote={props.getQuestionNote}
                readOnly={props.readOnly}
              />
              <Question3
                onUpdate={newQ3 => handleChecklistChange({ q3: newQ3 })}
                checklistState={currentChecklist}
                getQuestionNote={props.getQuestionNote}
                readOnly={props.readOnly}
              />
              <Question4
                onUpdate={newQ4 => handleChecklistChange({ q4: newQ4 })}
                checklistState={currentChecklist}
                getQuestionNote={props.getQuestionNote}
                readOnly={props.readOnly}
              />
              <Question5
                onUpdate={newQ5 => handleChecklistChange({ q5: newQ5 })}
                checklistState={currentChecklist}
                getQuestionNote={props.getQuestionNote}
                readOnly={props.readOnly}
              />
              <Question6
                onUpdate={newQ6 => handleChecklistChange({ q6: newQ6 })}
                checklistState={currentChecklist}
                getQuestionNote={props.getQuestionNote}
                readOnly={props.readOnly}
              />
              <Question7
                onUpdate={newQ7 => handleChecklistChange({ q7: newQ7 })}
                checklistState={currentChecklist}
                getQuestionNote={props.getQuestionNote}
                readOnly={props.readOnly}
              />
              <Question8
                onUpdate={newQ8 => handleChecklistChange({ q8: newQ8 })}
                checklistState={currentChecklist}
                getQuestionNote={props.getQuestionNote}
                readOnly={props.readOnly}
              />
              <Question9
                onUpdatea={newQ9a => handleChecklistChange({ q9a: newQ9a })}
                onUpdateb={newQ9b => handleChecklistChange({ q9b: newQ9b })}
                checklistState={currentChecklist}
                getQuestionNote={props.getQuestionNote}
                readOnly={props.readOnly}
              />
              <Question10
                onUpdate={newQ10 => handleChecklistChange({ q10: newQ10 })}
                checklistState={currentChecklist}
                getQuestionNote={props.getQuestionNote}
                readOnly={props.readOnly}
              />
              <Question11
                onUpdatea={newQ11a => handleChecklistChange({ q11a: newQ11a })}
                onUpdateb={newQ11b => handleChecklistChange({ q11b: newQ11b })}
                checklistState={currentChecklist}
                getQuestionNote={props.getQuestionNote}
                readOnly={props.readOnly}
              />
              <Question12
                onUpdate={newQ12 => handleChecklistChange({ q12: newQ12 })}
                checklistState={currentChecklist}
                getQuestionNote={props.getQuestionNote}
                readOnly={props.readOnly}
              />
              <Question13
                onUpdate={newQ13 => handleChecklistChange({ q13: newQ13 })}
                checklistState={currentChecklist}
                getQuestionNote={props.getQuestionNote}
                readOnly={props.readOnly}
              />
              <Question14
                onUpdate={newQ14 => handleChecklistChange({ q14: newQ14 })}
                checklistState={currentChecklist}
                getQuestionNote={props.getQuestionNote}
                readOnly={props.readOnly}
              />
              <Question15
                onUpdate={newQ15 => handleChecklistChange({ q15: newQ15 })}
                checklistState={currentChecklist}
                getQuestionNote={props.getQuestionNote}
                readOnly={props.readOnly}
              />
              <Question16
                onUpdate={newQ16 => handleChecklistChange({ q16: newQ16 })}
                checklistState={currentChecklist}
                getQuestionNote={props.getQuestionNote}
                readOnly={props.readOnly}
              />
            </div>
          </fieldset>
        </Show>
      </div>
    </div>
  );
}
