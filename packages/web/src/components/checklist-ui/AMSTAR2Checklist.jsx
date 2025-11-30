import { createSignal, createEffect, Show, For } from 'solid-js';
import { AMSTAR_CHECKLIST } from '../../AMSTAR2/checklist-map.js';
import { createChecklist as createAMSTAR2Checklist } from '../../AMSTAR2/checklist.js';
import { useParams, useNavigate } from '@solidjs/router';

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

  return (
    <div class='bg-white rounded-lg shadow-md p-8 text-sm'>
      <div class='flex'>
        <h3 class='font-semibold text-gray-900'>{question.text}</h3>
        <CriticalButton state={stateA} onUpdate={onUpdateab} />
      </div>
      <div class='font-semibold text-gray-900 h-4 mt-2 mb-1'>{question.subtitle}</div>
      <StandardQuestionInternal
        state={stateA}
        question={{ text: 'q9a' }}
        columns={question.columns}
        handleChange={handleChangeA}
      />
      <div class='font-semibold text-gray-900 h-4 mt-2'>{question.subtitle2}</div>
      <StandardQuestionInternal
        state={stateB}
        question={{ text: 'q9b' }}
        columns={question.columns2}
        handleChange={handleChangeB}
      />
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

  return (
    <div class='bg-white rounded-lg shadow-md p-8 text-sm'>
      <div class='flex'>
        <h3 class='font-semibold text-gray-900'>{question.text}</h3>
        <CriticalButton state={stateA} onUpdate={onUpdateab} />
      </div>

      <div class='font-semibold text-gray-900 h-4 mt-2'>{question.subtitle}</div>
      <StandardQuestionInternal
        state={stateA}
        question={{ text: 'q11a' }}
        columns={question.columns}
        handleChange={handleChangeA}
        width='w-48'
      />
      <div class='font-semibold text-gray-900 h-4 mt-4'>{question.subtitle2}</div>
      <StandardQuestionInternal
        state={stateB}
        question={{ text: 'q11b' }}
        columns={question.columns2}
        handleChange={handleChangeB}
        width='w-48'
      />
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
  return (
    <div class='bg-white rounded-lg shadow-md p-7'>
      <div class='flex'>
        <h3 class='font-semibold text-sm text-gray-900 mb-1'>{props.question.text}</h3>
        <CriticalButton state={props.state} onUpdate={props.onUpdate} />
      </div>
      <StandardQuestionInternal columns={props.question.columns} {...props} />
    </div>
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
        class={`ml-2 px-3 h-6 rounded-full text-xs font-medium transition-colors text-nowrap
        ${
          props.state().critical ?
            'bg-red-100 text-red-700 border border-red-300 hover:bg-red-200'
          : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
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
                `${props.width ?? 'w-32'} flex flex-col min-w-0`
              : 'flex-1 flex flex-col min-w-0'
            }
          >
            <div class='font-semibold text-gray-800 text-xs wrap-break-words whitespace-normal min-w-0 w-full min-h-8 flex items-center'>
              {col.label}
            </div>
            {colIdx() === props.columns.length - 1 ?
              <div class='flex flex-col gap-2 mt-1'>
                <For each={col.options}>
                  {(option, optIdx) => (
                    <label class='flex items-center space-x-2 text-xs'>
                      <input
                        type='radio'
                        name={`col-${colIdx()}-${props.question?.text ?? ''}`}
                        checked={props.state().answers[colIdx()][optIdx()]}
                        onChange={() => props.handleChange(colIdx(), optIdx())}
                        class='w-3.5 h-3.5 text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer'
                      />
                      <span class='text-gray-700 wrap-break-words'>{option}</span>
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
                        class='w-3 h-3 shrink-0 text-blue-600 border-gray-300 focus:ring-blue-500'
                      />
                      <span class='text-gray-700 wrap-break-words'>{option}</span>
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
  const [reviewName, setReviewName] = createSignal('');
  const [reviewerName, setReviewerName] = createSignal('');
  const [reviewDate, setReviewDate] = createSignal('');
  const [currentChecklist, setCurrentChecklist] = createSignal(null);
  const params = useParams();
  const navigate = useNavigate();

  // If an external checklist is supplied (from Yjs DO), use that as the source of truth.
  createEffect(async () => {
    if (props.externalChecklist) {
      setCurrentChecklist(props.externalChecklist);
      return;
    }

    // fallback: initialize a fresh checklist when not externally provided
    const newChecklist = createAMSTAR2Checklist({
      name: 'New 2 Checklist',
      id: 'local-1234',
      createdAt: Date.now(),
      reviewerName: '',
      reviewDate: '',
    });
    setCurrentChecklist(newChecklist);
  });

  // Keep the small UI fields in sync when the checklist (external or local) changes
  createEffect(() => {
    const cl = currentChecklist();
    if (!cl) return;
    setReviewName(cl.name || '');
    setReviewerName(cl.reviewerName || '');
    // Format createdAt to yyyy-MM-dd for date input
    const dateValue = cl.createdAt;
    if (dateValue) {
      // Check if it's already in yyyy-MM-dd format
      if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
        setReviewDate(dateValue);
      } else {
        // Convert timestamp or other date format to yyyy-MM-dd
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) {
          setReviewDate(date.toISOString().split('T')[0]);
        } else {
          setReviewDate('');
        }
      }
    } else {
      setReviewDate('');
    }
  });

  // Handler to update checklist state
  const handleChecklistChange = newState => {
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
      <div class='container mx-auto px-4 py-6 max-w-5xl'>
        {/* Header */}
        <div class='bg-white rounded-lg shadow-lg p-6 mb-8'>
          <h1 class='text-2xl font-bold text-gray-900 mb-4'>AMSTAR 2 Checklist</h1>

          {/* Review Details */}
          <div class='grid md:grid-cols-3 gap-4 text-xs'>
            <div>
              <label for='reviewName' class='block font-medium text-gray-700 mb-2'>
                Review Title
              </label>
              <input
                type='text'
                value={reviewName()}
                id='reviewName'
                onChange={e => {
                  setReviewName(e.target.value);
                  handleChecklistChange({ name: e.target.value });

                  // Update the route if checklist name changes
                  if (
                    params.projectSlug &&
                    params.reviewSlug &&
                    params.checklistSlug &&
                    currentChecklist()
                  ) {
                    const lastDash = params.checklistSlug.lastIndexOf('-');
                    const checklistId =
                      lastDash !== -1 ?
                        params.checklistSlug.slice(lastDash + 1)
                      : params.checklistSlug;
                    navigate(
                      `/projects/${params.projectSlug}/reviews/${params.reviewSlug}/checklists/${checklistId}`,
                      {
                        replace: true,
                      },
                    );
                  }
                }}
                class='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs'
                placeholder='Enter review title'
              />
            </div>
            <div>
              <label for='reviewerName' class='block font-medium text-gray-700 mb-2'>
                Reviewer Name
              </label>
              <input
                type='text'
                id='reviewerName'
                value={reviewerName()}
                onChange={e => {
                  setReviewerName(e.target.value);
                  handleChecklistChange({ reviewerName: e.target.value });
                }}
                class='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs'
                placeholder='Enter your name'
              />
            </div>
            <div>
              <label for='reviewDate' class='block font-medium text-gray-700 mb-2'>
                Review Date
              </label>
              <input
                type='date'
                id='reviewDate'
                value={reviewDate()}
                onChange={e => {
                  setReviewDate(e.target.value);
                  handleChecklistChange({ reviewDate: e.target.value });
                }}
                class='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs'
              />
            </div>
          </div>
        </div>

        {/* Questions */}
        <Show when={currentChecklist()} fallback={<div>Loading...</div>}>
          <div class='space-y-6'>
            <Question1
              onUpdate={newQ1 => handleChecklistChange({ q1: newQ1 })}
              checklistState={currentChecklist}
            />
            <Question2
              onUpdate={newQ2 => handleChecklistChange({ q2: newQ2 })}
              checklistState={currentChecklist}
            />
            <Question3
              onUpdate={newQ3 => handleChecklistChange({ q3: newQ3 })}
              checklistState={currentChecklist}
            />
            <Question4
              onUpdate={newQ4 => handleChecklistChange({ q4: newQ4 })}
              checklistState={currentChecklist}
            />
            <Question5
              onUpdate={newQ5 => handleChecklistChange({ q5: newQ5 })}
              checklistState={currentChecklist}
            />
            <Question6
              onUpdate={newQ6 => handleChecklistChange({ q6: newQ6 })}
              checklistState={currentChecklist}
            />
            <Question7
              onUpdate={newQ7 => handleChecklistChange({ q7: newQ7 })}
              checklistState={currentChecklist}
            />
            <Question8
              onUpdate={newQ8 => handleChecklistChange({ q8: newQ8 })}
              checklistState={currentChecklist}
            />
            <Question9
              onUpdatea={newQ9a => handleChecklistChange({ q9a: newQ9a })}
              onUpdateb={newQ9b => handleChecklistChange({ q9b: newQ9b })}
              checklistState={currentChecklist}
            />
            <Question10
              onUpdate={newQ10 => handleChecklistChange({ q10: newQ10 })}
              checklistState={currentChecklist}
            />
            <Question11
              onUpdatea={newQ11a => handleChecklistChange({ q11a: newQ11a })}
              onUpdateb={newQ11b => handleChecklistChange({ q11b: newQ11b })}
              checklistState={currentChecklist}
            />
            <Question12
              onUpdate={newQ12 => handleChecklistChange({ q12: newQ12 })}
              checklistState={currentChecklist}
            />
            <Question13
              onUpdate={newQ13 => handleChecklistChange({ q13: newQ13 })}
              checklistState={currentChecklist}
            />
            <Question14
              onUpdate={newQ14 => handleChecklistChange({ q14: newQ14 })}
              checklistState={currentChecklist}
            />
            <Question15
              onUpdate={newQ15 => handleChecklistChange({ q15: newQ15 })}
              checklistState={currentChecklist}
            />
            <Question16
              onUpdate={newQ16 => handleChecklistChange({ q16: newQ16 })}
              checklistState={currentChecklist}
            />
          </div>
        </Show>
      </div>
    </div>
  );
}
