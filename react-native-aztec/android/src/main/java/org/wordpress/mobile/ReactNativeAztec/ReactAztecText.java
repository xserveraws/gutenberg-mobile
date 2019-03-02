package org.wordpress.mobile.ReactNativeAztec;

import android.content.ClipData;
import android.content.ClipData.Item;
import android.content.ClipboardManager;
import android.content.Context;
import android.graphics.Rect;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;
import android.os.Build;
import android.text.Editable;
import android.text.InputType;
import android.text.Selection;
import android.text.Spannable;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.TextUtils;
import android.text.TextWatcher;
import android.text.method.ArrowKeyMovementMethod;
import android.text.method.KeyListener;
import android.text.method.QwertyKeyListener;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputConnection;
import android.view.inputmethod.InputMethodManager;
import android.widget.TextView;

import com.facebook.infer.annotation.Assertions;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.uimanager.PixelUtil;
import com.facebook.react.uimanager.UIManagerModule;
import com.facebook.react.uimanager.events.EventDispatcher;
import com.facebook.react.views.text.ReactTextUpdate;
import com.facebook.react.views.text.TextInlineImageSpan;
import com.facebook.react.views.textinput.ContentSizeWatcher;
import com.facebook.react.views.textinput.ReactTextInputLocalData;
import com.facebook.react.views.textinput.ScrollWatcher;
import com.facebook.react.views.view.ReactViewBackgroundManager;

import org.wordpress.aztec.AztecText;
import org.wordpress.aztec.AztecTextFormat;
import org.wordpress.aztec.ITextFormat;
import org.wordpress.aztec.plugins.IAztecPlugin;
import org.wordpress.aztec.plugins.IToolbarButton;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.Set;

import javax.annotation.Nullable;

/**
 * A wrapper around the AztecText that lets us better control what happens when an EditText gets
 * focused or blurred, and when to display the soft keyboard and when not to.
 *
 * ReactAztecTexts have setFocusableInTouchMode set to false automatically because touches on the
 * EditText are managed on the JS side. This also removes the nasty side effect that EditTexts
 * have, which is that focus is always maintained on one of the EditTexts.
 *
 * The wrapper stops the AztecText from triggering *TextChanged events, in the case where JS
 * has called this explicitly. This is the default behavior on other platforms as well.
 * VisibleForTesting from {@link TextInputEventsTestCase}.
 */
public class ReactAztecText extends AztecText {

    private final InputMethodManager mInputMethodManager;
    // This flag is set to true when we set the text of the EditText explicitly. In that case, no
    // *TextChanged events should be triggered. This is less expensive than removing the text
    // listeners and adding them back again after the text change is completed.
    private boolean mIsSettingTextFromJS;
    // This component is controlled, so we want it to get focused only when JS ask it to do so.
    // Whenever android requests focus (which it does for random reasons), it will be ignored.
    private boolean mIsJSSettingFocus;
    private int mDefaultGravityHorizontal;
    private int mDefaultGravityVertical;
    private int mNativeEventCount;
    private int mMostRecentEventCount;
    private @Nullable ArrayList<TextWatcher> mListeners;
    private @Nullable TextWatcherDelegator mTextWatcherDelegator;
    private int mStagedInputType;
    private boolean mContainsImages;
    private @Nullable Boolean mBlurOnSubmit;
    private boolean mDisableFullscreen;
    private @Nullable String mReturnKeyType;
    private @Nullable SelectionWatcher mSelectionWatcher;
    private @Nullable ContentSizeWatcher mContentSizeWatcher;
    private @Nullable ScrollWatcher mScrollWatcher;
    private InternalKeyListener mKeyListener;
    private boolean mDetectScrollMovement = false;
    private boolean mOnKeyPress = false;
    private float mLetterSpacingPt = 0;

    private ReactViewBackgroundManager mReactBackgroundManager;

    String lastSentFormattingOptionsEventString = "";
    boolean shouldHandleOnEnter = false;
    boolean shouldHandleOnBackspace = false;
    boolean shouldHandleOnPaste = false;
    boolean shouldHandleOnSelectionChange = false;
    boolean shouldHandleActiveFormatsChange = false;

    private static final KeyListener sKeyListener = QwertyKeyListener.getInstanceForFullKeyboard();

    private static final HashMap<ITextFormat, String> typingFormatsMap = new HashMap<ITextFormat, String>() {
        {
            put(AztecTextFormat.FORMAT_BOLD, "bold");
            put(AztecTextFormat.FORMAT_STRONG, "bold");
            put(AztecTextFormat.FORMAT_EMPHASIS, "italic");
            put(AztecTextFormat.FORMAT_ITALIC, "italic");
            put(AztecTextFormat.FORMAT_CITE, "italic");
            put(AztecTextFormat.FORMAT_STRIKETHROUGH, "strikethrough");
        }
    };

    ReactViewBackgroundManager getReactBackgroundManager() {
        if (mReactBackgroundManager == null) {
            mReactBackgroundManager = new ReactViewBackgroundManager(this);
        }

        return mReactBackgroundManager;
    }

    InternalKeyListener getInternalKeyListener() {
        if (mKeyListener == null) {
            mKeyListener = new InternalKeyListener();
        }

        return mKeyListener;
    }
    public ReactAztecText(Context context) {
        super(context);
        setFocusableInTouchMode(false);

        // don't auto-focus when Aztec becomes visible.
        // Needed on rotation and multiple Aztec instances to avoid losing the exact care position.
        setFocusOnVisible(false);

        forceCaretAtStartOnTakeFocus();

        this.setAztecKeyListener(new ReactAztecText.OnAztecKeyListener() {
            @Override
            public boolean onEnterKey() {
                if (shouldHandleOnEnter) {
                    return onEnter();
                }
                return false;
            }
            @Override
            public boolean onBackspaceKey() {
                if (shouldHandleOnBackspace) {
                    return onBackspace();
                }
                return false;
            }
        });

        this.setOnSelectionChangedListener(new OnSelectionChangedListener() {
            @Override
            public void onSelectionChanged(int selStart, int selEnd) {
                ReactAztecText.this.updateToolbarButtons(selStart, selEnd);
                ReactAztecText.this.propagateSelectionChanges(selStart, selEnd);
            }
        });
        this.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES | InputType.TYPE_TEXT_FLAG_MULTI_LINE);

        mInputMethodManager = (InputMethodManager)
                Assertions.assertNotNull(getContext().getSystemService(Context.INPUT_METHOD_SERVICE));
        mDefaultGravityHorizontal =
                getGravity() & (Gravity.HORIZONTAL_GRAVITY_MASK | Gravity.RELATIVE_HORIZONTAL_GRAVITY_MASK);
        mDefaultGravityVertical = getGravity() & Gravity.VERTICAL_GRAVITY_MASK;
        mNativeEventCount = 0;
        mMostRecentEventCount = 0;
        mIsSettingTextFromJS = false;
        mIsJSSettingFocus = false;
        mBlurOnSubmit = null;
        mDisableFullscreen = false;
        mListeners = null;
        mTextWatcherDelegator = null;
        mStagedInputType = getInputType();
        mScrollWatcher = null;
    }

    private void forceCaretAtStartOnTakeFocus() {
        // set a custom ArrowKeyMovementMethod: sets caret to the start of the text instead of the default (end of text)
        // Fixes https://github.com/wordpress-mobile/gutenberg-mobile/issues/602
        // onTakeFocus adapted from the Android source code at:
        //  https://android.googlesource.com/platform/frameworks/base/+/refs/heads/pie-release/core/java/android/text/method/ArrowKeyMovementMethod.java#316
        setMovementMethod(new ArrowKeyMovementMethod() {
            @Override
            public void onTakeFocus(TextView view, Spannable text, int dir) {
                if ((dir & (View.FOCUS_FORWARD | View.FOCUS_DOWN)) != 0) {
                    if (view.getLayout() == null) {
                        // This shouldn't be null, but do something sensible if it is.
                        Selection.setSelection(text, 0); // <-- setting caret to start of text
                    }
                } else {
                    Selection.setSelection(text, text.length());  // <-- same as original Android implementation. Not sure if we should change this too
                }
            }
        });

    }

    void addPlugin(IAztecPlugin plugin) {
        super.getPlugins().add(plugin);
        if (plugin instanceof IToolbarButton && getToolbar() != null ) {
            getToolbar().addButton((IToolbarButton)plugin);
        }
    }

    @Override
    public boolean onTextContextMenuItem(int id) {
        if (shouldHandleOnPaste) {
            switch (id) {
                case android.R.id.paste:
                    return onPaste(false);
                case android.R.id.pasteAsPlainText:
                    return onPaste(true);
            }
        }

        return super.onTextContextMenuItem(id);
    }

    private void updateToolbarButtons(int selStart, int selEnd) {
        ArrayList<ITextFormat> appliedStyles = getAppliedStyles(selStart, selEnd);
        updateToolbarButtons(appliedStyles);
    }

    private void updateToolbarButtons(ArrayList<ITextFormat> appliedStyles) {
        // Read the applied styles and get the String list of formatting options
        LinkedList<String> formattingOptions = new LinkedList<>();
        for (ITextFormat currentStyle : appliedStyles) {
            if ((currentStyle == AztecTextFormat.FORMAT_STRONG || currentStyle == AztecTextFormat.FORMAT_BOLD)
                    && !formattingOptions.contains("bold")) {
                formattingOptions.add("bold");
            }
            if ((currentStyle == AztecTextFormat.FORMAT_ITALIC || currentStyle == AztecTextFormat.FORMAT_CITE)
                    && !formattingOptions.contains("italic")) {
                formattingOptions.add("italic");
            }
            if (currentStyle == AztecTextFormat.FORMAT_STRIKETHROUGH) {
                formattingOptions.add("strikethrough");
            }
        }

        // Check if the same formatting event was already sent
        String newOptionsAsString = "";
        for (String currentFormatting: formattingOptions) {
            newOptionsAsString += currentFormatting;
        }
        if (newOptionsAsString.equals(lastSentFormattingOptionsEventString)) {
            // no need to send any event now
            return;
        }
        lastSentFormattingOptionsEventString = newOptionsAsString;

        if (shouldHandleActiveFormatsChange) {
            ReactContext reactContext = (ReactContext) getContext();
            EventDispatcher eventDispatcher = reactContext.getNativeModule(UIManagerModule.class).getEventDispatcher();
            eventDispatcher.dispatchEvent(
                    new ReactAztecFormattingChangeEvent(
                            getId(),
                            formattingOptions.toArray(new String[formattingOptions.size()])
                    )
            );
        }
    }

    private void propagateSelectionChanges(int selStart, int selEnd) {
        if (!shouldHandleOnSelectionChange) {
            return;
        }
        String content = toHtml(false);
        ReactContext reactContext = (ReactContext) getContext();
        EventDispatcher eventDispatcher = reactContext.getNativeModule(UIManagerModule.class).getEventDispatcher();
        eventDispatcher.dispatchEvent(
                new ReactAztecSelectionChangeEvent(getId(), content, selStart, selEnd, incrementAndGetEventCounter())
        );
    }

    private boolean onEnter() {
        disableTextChangedListener();
        String content = toHtml(false);
        int cursorPositionStart = getSelectionStart();
        int cursorPositionEnd = getSelectionEnd();
        enableTextChangedListener();
        ReactContext reactContext = (ReactContext) getContext();
        EventDispatcher eventDispatcher = reactContext.getNativeModule(UIManagerModule.class).getEventDispatcher();
        eventDispatcher.dispatchEvent(
                new ReactAztecEnterEvent(getId(), content, cursorPositionStart, cursorPositionEnd, incrementAndGetEventCounter())
        );
        return true;
    }

    private boolean onBackspace() {
        int cursorPositionStart = getSelectionStart();
        int cursorPositionEnd = getSelectionEnd();
        // Make sure to report backspace at the beginning only, with no selection.
        if (cursorPositionStart != 0 || cursorPositionEnd != 0) {
            return false;
        }

        disableTextChangedListener();
        String content = toHtml(false);
        enableTextChangedListener();
        ReactContext reactContext = (ReactContext) getContext();
        EventDispatcher eventDispatcher = reactContext.getNativeModule(UIManagerModule.class).getEventDispatcher();
        // TODO: isRTL? Should be passed here?
        eventDispatcher.dispatchEvent(
                new ReactAztecBackspaceEvent(getId(), content, cursorPositionStart, cursorPositionEnd)
        );
        return true;
    }

    /**
     * Handle paste action by retrieving clipboard contents and dispatching a
     * {@link ReactAztecPasteEvent} with the data
     *
     * @param   isPastedAsPlainText boolean indicating whether the paste action chosen was
     *                         "PASTE AS PLAIN TEXT"
     *
     * @return  boolean to indicate that the action was handled (always true)
     */
    private boolean onPaste(boolean isPastedAsPlainText) {
        ClipboardManager clipboardManager = (ClipboardManager) getContext().getSystemService(
                Context.CLIPBOARD_SERVICE);

        StringBuilder text = new StringBuilder();
        StringBuilder html = new StringBuilder();

        if (clipboardManager != null && clipboardManager.hasPrimaryClip()) {
            ClipData clipData = clipboardManager.getPrimaryClip();
            int itemCount = clipData.getItemCount();

            for (int i = 0; i < itemCount; i++) {
                Item item = clipData.getItemAt(i);
                text.append(item.coerceToText(getContext()));
                if (!isPastedAsPlainText) {
                    html.append(item.coerceToHtmlText(getContext()));
                }
            }
        }

        // temporarily disable listener during call to toHtml()
        disableTextChangedListener();
        String content = toHtml(false);
        int cursorPositionStart = getSelectionStart();
        int cursorPositionEnd = getSelectionEnd();
        enableTextChangedListener();
        ReactContext reactContext = (ReactContext) getContext();
        EventDispatcher eventDispatcher = reactContext.getNativeModule(UIManagerModule.class)
                .getEventDispatcher();
        eventDispatcher.dispatchEvent(new ReactAztecPasteEvent(getId(), content,
                cursorPositionStart, cursorPositionEnd, text.toString(), html.toString())
        );
        return true;
    }

    public void setActiveFormats(Iterable<String> newFormats) {
        Set<ITextFormat> selectedStylesSet = new HashSet<>(getSelectedStyles());
        Set<ITextFormat> newFormatsSet = new HashSet<>();
        for (String newFormat : newFormats) {
            switch (newFormat) {
                case "bold":
                    newFormatsSet.add(AztecTextFormat.FORMAT_STRONG);
                    break;
                case "italic":
                    newFormatsSet.add(AztecTextFormat.FORMAT_EMPHASIS);
                    break;
                case "strikethrough":
                    newFormatsSet.add(AztecTextFormat.FORMAT_STRIKETHROUGH);
                    break;
            }
        }
        selectedStylesSet.removeAll(typingFormatsMap.keySet());
        selectedStylesSet.addAll(newFormatsSet);
        ArrayList<ITextFormat> newStylesList = new ArrayList<>(selectedStylesSet);
        setSelectedStyles(newStylesList);
        updateToolbarButtons(newStylesList);
    }

    // After the text changes inside an EditText, TextView checks if a layout() has been requested.
    // If it has, it will not scroll the text to the end of the new text inserted, but wait for the
    // next layout() to be called. However, we do not perform a layout() after a requestLayout(), so
    // we need to override isLayoutRequested to force EditText to scroll to the end of the new text
    // immediately.
    // TODO: t6408636 verify if we should schedule a layout after a View does a requestLayout()
    @Override
    public boolean isLayoutRequested() {
        return false;
    }

    @Override
    protected void onLayout(boolean changed, int left, int top, int right, int bottom) {
        onContentSizeChange();
    }

    @Override
    public boolean onTouchEvent(MotionEvent ev) {
        switch (ev.getAction()) {
            case MotionEvent.ACTION_DOWN:
                mDetectScrollMovement = true;
                // Disallow parent views to intercept touch events, until we can detect if we should be
                // capturing these touches or not.
                this.getParent().requestDisallowInterceptTouchEvent(true);
                break;
            case MotionEvent.ACTION_MOVE:
                if (mDetectScrollMovement) {
                    if (!canScrollVertically(-1) &&
                            !canScrollVertically(1) &&
                            !canScrollHorizontally(-1) &&
                            !canScrollHorizontally(1)) {
                        // We cannot scroll, let parent views take care of these touches.
                        this.getParent().requestDisallowInterceptTouchEvent(false);
                    }
                    mDetectScrollMovement = false;
                }
                break;
        }
        return super.onTouchEvent(ev);
    }

    // Consume 'Enter' key events: TextView tries to give focus to the next TextInput, but it can't
    // since we only allow JS to change focus, which in turn causes TextView to crash.
    @Override
    public boolean onKeyUp(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_ENTER && !isMultiline()) {
            hideSoftKeyboard();
            return true;
        }
        return super.onKeyUp(keyCode, event);
    }

    @Override
    protected void onScrollChanged(int horiz, int vert, int oldHoriz, int oldVert) {
        super.onScrollChanged(horiz, vert, oldHoriz, oldVert);

        if (mScrollWatcher != null) {
            mScrollWatcher.onScrollChanged(horiz, vert, oldHoriz, oldVert);
        }
    }

    @Override
    public InputConnection onCreateInputConnection(EditorInfo outAttrs) {
        ReactContext reactContext = (ReactContext) getContext();
        InputConnection inputConnection = super.onCreateInputConnection(outAttrs);
        if (inputConnection != null && mOnKeyPress) {
            inputConnection = new ReactEditTextInputConnectionWrapper(inputConnection, reactContext, this);
        }

        if (isMultiline() && getBlurOnSubmit()) {
            // Remove IME_FLAG_NO_ENTER_ACTION to keep the original IME_OPTION
            outAttrs.imeOptions &= ~EditorInfo.IME_FLAG_NO_ENTER_ACTION;
        }
        return inputConnection;
    }

    @Override
    public void clearFocus() {
        setFocusableInTouchMode(false);
        super.clearFocus();
        hideSoftKeyboard();
    }

    @Override
    public boolean requestFocus(int direction, Rect previouslyFocusedRect) {
        // Always return true if we are already focused. This is used by android in certain places,
        // such as text selection.
        if (isFocused()) {
            return true;
        }
        if (!mIsJSSettingFocus) {
            return false;
        }
        setFocusableInTouchMode(true);
        boolean focused = super.requestFocus(direction, previouslyFocusedRect);
        showSoftKeyboard();
        return focused;
    }

    @Override
    public void addTextChangedListener(TextWatcher watcher) {
        if (mListeners == null) {
            mListeners = new ArrayList<>();
            super.addTextChangedListener(getTextWatcherDelegator());
        }

        mListeners.add(watcher);
    }

    @Override
    public void removeTextChangedListener(TextWatcher watcher) {
        if (mListeners != null) {
            mListeners.remove(watcher);

            if (mListeners.isEmpty()) {
                mListeners = null;
                super.removeTextChangedListener(getTextWatcherDelegator());
            }
        }
    }

    public void setContentSizeWatcher(ContentSizeWatcher contentSizeWatcher) {
        mContentSizeWatcher = contentSizeWatcher;
    }

    public void setScrollWatcher(ScrollWatcher scrollWatcher) {
        mScrollWatcher = scrollWatcher;
    }

    @Override
    public void setSelection(int start, int end) {
        // Skip setting the selection if the text wasn't set because of an out of date value.
        if (mMostRecentEventCount < mNativeEventCount) {
            return;
        }

        super.setSelection(start, end);
    }

    @Override
    public void onSelectionChanged(int selStart, int selEnd) {
        super.onSelectionChanged(selStart, selEnd);
        if (mSelectionWatcher != null && hasFocus()) {
            mSelectionWatcher.onSelectionChanged(selStart, selEnd);
        }
    }

    @Override
    protected void onFocusChanged(
            boolean focused, int direction, Rect previouslyFocusedRect) {
        super.onFocusChanged(focused, direction, previouslyFocusedRect);
        if (focused && mSelectionWatcher != null) {
            mSelectionWatcher.onSelectionChanged(getSelectionStart(), getSelectionEnd());
        }
    }

    public void setSelectionWatcher(SelectionWatcher selectionWatcher) {
        mSelectionWatcher = selectionWatcher;
    }

    public void setBlurOnSubmit(@Nullable Boolean blurOnSubmit) {
        mBlurOnSubmit = blurOnSubmit;
    }

    public void setOnKeyPress(boolean onKeyPress) {
        mOnKeyPress = onKeyPress;
    }

    public boolean getBlurOnSubmit() {
        if (mBlurOnSubmit == null) {
            // Default blurOnSubmit
            return isMultiline() ? false : true;
        }

        return mBlurOnSubmit;
    }

    public void setDisableFullscreenUI(boolean disableFullscreenUI) {
        mDisableFullscreen = disableFullscreenUI;
        updateImeOptions();
    }

    public boolean getDisableFullscreenUI() {
        return mDisableFullscreen;
    }

    public void setReturnKeyType(String returnKeyType) {
        mReturnKeyType = returnKeyType;
        updateImeOptions();
    }

    public String getReturnKeyType() {
        return mReturnKeyType;
    }

    /*protected*/ int getStagedInputType() {
        return mStagedInputType;
    }

    /*package*/ void setStagedInputType(int stagedInputType) {
        mStagedInputType = stagedInputType;
    }

    /*package*/ void commitStagedInputType() {
        if (getInputType() != mStagedInputType) {
            int selectionStart = getSelectionStart();
            int selectionEnd = getSelectionEnd();
            setInputType(mStagedInputType);
            setSelection(selectionStart, selectionEnd);
        }
    }

    @Override
    public void setInputType(int type) {
        Typeface tf = super.getTypeface();
        super.setInputType(type);
        mStagedInputType = type;
        // Input type password defaults to monospace font, so we need to re-apply the font
        super.setTypeface(tf);

        // We override the KeyListener so that all keys on the soft input keyboard as well as hardware
        // keyboards work. Some KeyListeners like DigitsKeyListener will display the keyboard but not
        // accept all input from it
        getInternalKeyListener().setInputType(type);
        setKeyListener(getInternalKeyListener());
    }

    // VisibleForTesting from {@link TextInputEventsTestCase}.
    public void requestFocusFromJS() {
        mIsJSSettingFocus = true;
        requestFocus();
        mIsJSSettingFocus = false;
    }

    /* package */ void clearFocusFromJS() {
        clearFocus();
    }

    // VisibleForTesting from {@link TextInputEventsTestCase}.
    public int incrementAndGetEventCounter() {
        return ++mNativeEventCount;
    }

    // VisibleForTesting from {@link TextInputEventsTestCase}.
    public void maybeSetText(ReactTextUpdate reactTextUpdate) {
        if( isSecureText() &&
                TextUtils.equals(getText(), reactTextUpdate.getText())) {
            return;
        }

        // Only set the text if it is up to date.
        mMostRecentEventCount = reactTextUpdate.getJsEventCounter();
        if (mMostRecentEventCount < mNativeEventCount) {
            return;
        }

//        // The current text gets replaced with the text received from JS. However, the spans on the
//        // current text need to be adapted to the new text. Since TextView#setText() will remove or
//        // reset some of these spans even if they are set directly, SpannableStringBuilder#replace() is
//        // used instead (this is also used by the the keyboard implementation underneath the covers).
//        SpannableStringBuilder spannableStringBuilder =
//                new SpannableStringBuilder(reactTextUpdate.getText());
//        manageSpans(spannableStringBuilder);
//        mContainsImages = reactTextUpdate.containsImages();
        mIsSettingTextFromJS = true;
//
//        getText().replace(0, length(), spannableStringBuilder);
        fromHtml(reactTextUpdate.getText().toString(), true);


        mIsSettingTextFromJS = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (getBreakStrategy() != reactTextUpdate.getTextBreakStrategy()) {
                setBreakStrategy(reactTextUpdate.getTextBreakStrategy());
            }
        }
    }

//    /**
//     * Remove and/or add {@link Spanned.SPAN_EXCLUSIVE_EXCLUSIVE} spans, since they should only exist
//     * as long as the text they cover is the same. All other spans will remain the same, since they
//     * will adapt to the new text, hence why {@link SpannableStringBuilder#replace} never removes
//     * them.
//     */
//    private void manageSpans(SpannableStringBuilder spannableStringBuilder) {
//        Object[] spans = getText().getSpans(0, length(), Object.class);
//        for (int spanIdx = 0; spanIdx < spans.length; spanIdx++) {
//            // Remove all styling spans we might have previously set
//            if (ForegroundColorSpan.class.isInstance(spans[spanIdx]) ||
//                    BackgroundColorSpan.class.isInstance(spans[spanIdx]) ||
//                    AbsoluteSizeSpan.class.isInstance(spans[spanIdx]) ||
//                    CustomStyleSpan.class.isInstance(spans[spanIdx]) ||
//                    ReactTagSpan.class.isInstance(spans[spanIdx])) {
//                getText().removeSpan(spans[spanIdx]);
//            }
//
//            if ((getText().getSpanFlags(spans[spanIdx]) & Spanned.SPAN_EXCLUSIVE_EXCLUSIVE) !=
//                    Spanned.SPAN_EXCLUSIVE_EXCLUSIVE) {
//                continue;
//            }
//            Object span = spans[spanIdx];
//            final int spanStart = getText().getSpanStart(spans[spanIdx]);
//            final int spanEnd = getText().getSpanEnd(spans[spanIdx]);
//            final int spanFlags = getText().getSpanFlags(spans[spanIdx]);
//
//            // Make sure the span is removed from existing text, otherwise the spans we set will be
//            // ignored or it will cover text that has changed.
//            getText().removeSpan(spans[spanIdx]);
//            if (sameTextForSpan(getText(), spannableStringBuilder, spanStart, spanEnd)) {
//                spannableStringBuilder.setSpan(span, spanStart, spanEnd, spanFlags);
//            }
//        }
//    }

//    private static boolean sameTextForSpan(
//            final Editable oldText,
//            final SpannableStringBuilder newText,
//            final int start,
//            final int end) {
//        if (start > newText.length() || end > newText.length()) {
//            return false;
//        }
//        for (int charIdx = start; charIdx < end; charIdx++) {
//            if (oldText.charAt(charIdx) != newText.charAt(charIdx)) {
//                return false;
//            }
//        }
//        return true;
//    }

    private boolean showSoftKeyboard() {
        return mInputMethodManager.showSoftInput(this, 0);
    }

    private void hideSoftKeyboard() {
        mInputMethodManager.hideSoftInputFromWindow(getWindowToken(), 0);
    }

    private TextWatcherDelegator getTextWatcherDelegator() {
        if (mTextWatcherDelegator == null) {
            mTextWatcherDelegator = new TextWatcherDelegator();
        }
        return mTextWatcherDelegator;
    }

    private boolean isMultiline() {
        return (getInputType() & InputType.TYPE_TEXT_FLAG_MULTI_LINE) != 0;
    }

    private boolean isSecureText() {
        return
                (getInputType() &
                        (InputType.TYPE_NUMBER_VARIATION_PASSWORD |
                                InputType.TYPE_TEXT_VARIATION_PASSWORD))
                        != 0;
    }

    private void onContentSizeChange() {
        if (mContentSizeWatcher != null) {
            mContentSizeWatcher.onLayout();
        }

        setIntrinsicContentSize();
    }

    private void setIntrinsicContentSize() {
        ReactContext reactContext = (ReactContext) getContext();
        UIManagerModule uiManager = reactContext.getNativeModule(UIManagerModule.class);
        final ReactTextInputLocalData localData = new ReactTextInputLocalData(this);
        uiManager.setViewLocalData(getId(), localData);
    }

    /* package */ void setGravityHorizontal(int gravityHorizontal) {
        if (gravityHorizontal == 0) {
            gravityHorizontal = mDefaultGravityHorizontal;
        }
        setGravity(
                (getGravity() & ~Gravity.HORIZONTAL_GRAVITY_MASK &
                        ~Gravity.RELATIVE_HORIZONTAL_GRAVITY_MASK) | gravityHorizontal);
    }

    /* package */ void setGravityVertical(int gravityVertical) {
        if (gravityVertical == 0) {
            gravityVertical = mDefaultGravityVertical;
        }
        setGravity((getGravity() & ~Gravity.VERTICAL_GRAVITY_MASK) | gravityVertical);
    }

    private void updateImeOptions() {
        // Default to IME_ACTION_DONE
        int returnKeyFlag = EditorInfo.IME_ACTION_DONE;
        if (mReturnKeyType != null) {
            switch (mReturnKeyType) {
                case "go":
                    returnKeyFlag = EditorInfo.IME_ACTION_GO;
                    break;
                case "next":
                    returnKeyFlag = EditorInfo.IME_ACTION_NEXT;
                    break;
                case "none":
                    returnKeyFlag = EditorInfo.IME_ACTION_NONE;
                    break;
                case "previous":
                    returnKeyFlag = EditorInfo.IME_ACTION_PREVIOUS;
                    break;
                case "search":
                    returnKeyFlag = EditorInfo.IME_ACTION_SEARCH;
                    break;
                case "send":
                    returnKeyFlag = EditorInfo.IME_ACTION_SEND;
                    break;
                case "done":
                    returnKeyFlag = EditorInfo.IME_ACTION_DONE;
                    break;
            }
        }

        if (mDisableFullscreen) {
            setImeOptions(returnKeyFlag | EditorInfo.IME_FLAG_NO_FULLSCREEN);
        } else {
            setImeOptions(returnKeyFlag);
        }
    }

    @Override
    protected boolean verifyDrawable(Drawable drawable) {
        if (mContainsImages) {
            Spanned text = getText();
            TextInlineImageSpan[] spans = text.getSpans(0, text.length(), TextInlineImageSpan.class);
            for (TextInlineImageSpan span : spans) {
                if (span.getDrawable() == drawable) {
                    return true;
                }
            }
        }
        return super.verifyDrawable(drawable);
    }

    @Override
    public void invalidateDrawable(Drawable drawable) {
        if (mContainsImages) {
            Spanned text = getText();
            TextInlineImageSpan[] spans = text.getSpans(0, text.length(), TextInlineImageSpan.class);
            for (TextInlineImageSpan span : spans) {
                if (span.getDrawable() == drawable) {
                    invalidate();
                }
            }
        }
        super.invalidateDrawable(drawable);
    }

    @Override
    public void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        if (mContainsImages) {
            Spanned text = getText();
            TextInlineImageSpan[] spans = text.getSpans(0, text.length(), TextInlineImageSpan.class);
            for (TextInlineImageSpan span : spans) {
                span.onDetachedFromWindow();
            }
        }
    }

    @Override
    public void onStartTemporaryDetach() {
        super.onStartTemporaryDetach();
        if (mContainsImages) {
            Spanned text = getText();
            TextInlineImageSpan[] spans = text.getSpans(0, text.length(), TextInlineImageSpan.class);
            for (TextInlineImageSpan span : spans) {
                span.onStartTemporaryDetach();
            }
        }
    }

    @Override
    public void onAttachedToWindow() {
        super.onAttachedToWindow();
        if (mContainsImages) {
            Spanned text = getText();
            TextInlineImageSpan[] spans = text.getSpans(0, text.length(), TextInlineImageSpan.class);
            for (TextInlineImageSpan span : spans) {
                span.onAttachedToWindow();
            }
        }
    }

    @Override
    public void onFinishTemporaryDetach() {
        super.onFinishTemporaryDetach();
        if (mContainsImages) {
            Spanned text =  getText();
            TextInlineImageSpan[] spans = text.getSpans(0, text.length(), TextInlineImageSpan.class);
            for (TextInlineImageSpan span : spans) {
                span.onFinishTemporaryDetach();
            }
        }
    }

    @Override
    public void setBackgroundColor(int color) {
        getReactBackgroundManager().setBackgroundColor(color);
    }

    public void setBorderWidth(int position, float width) {
        getReactBackgroundManager().setBorderWidth(position, width);
    }

    public void setBorderColor(int position, float color, float alpha) {
        getReactBackgroundManager().setBorderColor(position, color, alpha);
    }

    public void setBorderRadius(float borderRadius) {
        getReactBackgroundManager().setBorderRadius(borderRadius);
    }

    public void setBorderRadius(float borderRadius, int position) {
        getReactBackgroundManager().setBorderRadius(borderRadius, position);
    }

    public void setBorderStyle(@Nullable String style) {
        getReactBackgroundManager().setBorderStyle(style);
    }

    public void setLetterSpacingPt(float letterSpacingPt) {
        mLetterSpacingPt = letterSpacingPt;
        updateLetterSpacing();
    }

    @Override
    public void setTextSize (float size) {
        super.setTextSize(size);
        updateLetterSpacing();
    }

    @Override
    public void setTextSize (int unit, float size) {
        super.setTextSize(unit, size);
        updateLetterSpacing();
    }

    protected void updateLetterSpacing() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            setLetterSpacing(PixelUtil.toPixelFromSP(mLetterSpacingPt) / getTextSize());
        }
    }

    /**
     * This class will redirect *TextChanged calls to the listeners only in the case where the text
     * is changed by the user, and not explicitly set by JS.
     */
    private class TextWatcherDelegator implements TextWatcher {
        @Override
        public void beforeTextChanged(CharSequence s, int start, int count, int after) {
            if (!mIsSettingTextFromJS && mListeners != null) {
                for (TextWatcher listener : mListeners) {
                    listener.beforeTextChanged(s, start, count, after);
                }
            }
        }

        @Override
        public void onTextChanged(CharSequence s, int start, int before, int count) {
            if (!mIsSettingTextFromJS && mListeners != null) {
                for (TextWatcher listener : mListeners) {
                    listener.onTextChanged(s, start, before, count);
                }
            }

            onContentSizeChange();
        }

        @Override
        public void afterTextChanged(Editable s) {
            if (!mIsSettingTextFromJS && mListeners != null) {
                for (TextWatcher listener : mListeners) {
                    listener.afterTextChanged(s);
                }
            }
        }
    }

    /*
     * This class is set as the KeyListener for the underlying TextView
     * It does two things
     *  1) Provides the same answer to getInputType() as the real KeyListener would have which allows
     *     the proper keyboard to pop up on screen
     *  2) Permits all keyboard input through
     */
    private static class InternalKeyListener implements KeyListener {

        private int mInputType = 0;

        public InternalKeyListener() {
        }

        public void setInputType(int inputType) {
            mInputType = inputType;
        }

        /*
         * getInputType will return whatever value is passed in.  This will allow the proper keyboard
         * to be shown on screen but without the actual filtering done by other KeyListeners
         */
        @Override
        public int getInputType() {
            return mInputType;
        }

        /*
         * All overrides of key handling defer to the underlying KeyListener which is shared by all
         * ReactEditText instances.  It will basically allow any/all keyboard input whether from
         * physical keyboard or from soft input.
         */
        @Override
        public boolean onKeyDown(View view, Editable text, int keyCode, KeyEvent event) {
            return sKeyListener.onKeyDown(view, text, keyCode, event);
        }

        @Override
        public boolean onKeyUp(View view, Editable text, int keyCode, KeyEvent event) {
            return sKeyListener.onKeyUp(view, text, keyCode, event);
        }

        @Override
        public boolean onKeyOther(View view, Editable text, KeyEvent event) {
            return sKeyListener.onKeyOther(view, text, event);
        }

        @Override
        public void clearMetaKeyState(View view, Editable content, int states) {
            sKeyListener.clearMetaKeyState(view, content, states);
        }
    }
}
